import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { DISCOUNT_KINDS } from "@base-template/db/schema/restaurant-orders";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { consumeOverride } from "../../lib/override";
import {
  actingTokenInput,
  idempotencyKey,
  assertSessionUnsettled,
  findVoidByKey,
  isLineSent,
  loadLineInScope,
  loadSessionInScope,
  resolveActingMemberId,
} from "./orders-shared";
import type { OrderContext } from "./orders-shared";

export const voidLineInput = z.object({
  lineId: z.string().min(1),
  reason: z.string().trim().min(1).max(200).optional(),
  overrideId: z.string().min(1).optional(),
  idempotencyKey,
  actingToken: actingTokenInput,
});
export type VoidLineInput = z.infer<typeof voidLineInput>;

/** Thrown inside the void transaction when a concurrent call with the same key won; rolls it back. */
class ConcurrentReplay extends Error {
  constructor(readonly voided: typeof schema.orderLineVoid.$inferSelect) {
    super("The void was recorded by a concurrent call with the same key.");
  }
}

/**
 * Voids an Order line; a sent line needs an Override spent in the same transaction. Idempotent
 * per key: `replayed` is true when the key had already recorded the void, also under concurrency.
 */
export async function voidLineCore(
  context: OrderContext,
  input: VoidLineInput,
): Promise<{ voided: typeof schema.orderLineVoid.$inferSelect; replayed: boolean }> {
  const { line, session } = await loadLineInScope(context, input.lineId);
  const replay = await findVoidByKey(context, input.idempotencyKey, line.id);
  if (replay) {
    return { voided: replay, replayed: true };
  }
  assertSessionUnsettled(session);
  const [alreadyVoided] = await context.db
    .select({ id: schema.orderLineVoid.id })
    .from(schema.orderLineVoid)
    .where(eq(schema.orderLineVoid.orderLineId, line.id));
  if (alreadyVoided) {
    throw new ORPCError("CONFLICT", { message: "This line is already voided." });
  }

  const sent = await isLineSent(context, line.id);
  if (sent && !input.overrideId) {
    throw new ORPCError("FORBIDDEN", {
      message: "Voiding a line already sent to the kitchen needs an Override.",
      data: { reason: "override_required" },
    });
  }
  const memberId = await resolveActingMemberId(context, session.locationId, input.actingToken);

  let outcome: {
    created: typeof schema.orderLineVoid.$inferSelect;
    approverMemberId: string | null;
  };
  try {
    outcome = await context.db.transaction(async (tx) => {
      const approver =
        sent && input.overrideId
          ? await consumeOverride(
              { db: tx, clock: context.clock },
              {
                organizationId: context.org.id,
                actorUserId: context.session.user.id,
                overrideId: input.overrideId,
                locationId: session.locationId,
                action: "void_line",
                target: line.id,
              },
            )
          : null;
      const [inserted] = await tx
        .insert(schema.orderLineVoid)
        .values({
          organizationId: context.org.id,
          orderLineId: line.id,
          reason: input.reason ?? null,
          overrideId: sent ? (input.overrideId ?? null) : null,
          recordedByMemberId: memberId,
          recordedAt: context.clock.now(),
          idempotencyKey: input.idempotencyKey,
        })
        .onConflictDoNothing()
        .returning();
      if (!inserted) {
        // The same key won a race: report its void and roll back the spent Override.
        const winner = await findVoidByKey(
          { ...context, db: tx as unknown as Database },
          input.idempotencyKey,
          line.id,
        );
        if (winner) {
          throw new ConcurrentReplay(winner);
        }
        // Voided under another key: roll back the spent Override.
        throw new ORPCError("CONFLICT", { message: "This line is already voided." });
      }
      return { created: inserted, approverMemberId: approver?.approverMemberId ?? null };
    });
  } catch (error) {
    if (error instanceof ConcurrentReplay) {
      return { voided: error.voided, replayed: true };
    }
    if (error instanceof ORPCError) {
      // A concurrent call with this key may have recorded the void and spent the Override first.
      const winner = await findVoidByKey(context, input.idempotencyKey, line.id);
      if (winner) {
        return { voided: winner, replayed: true };
      }
    }
    throw error;
  }
  const { created, approverMemberId } = outcome;

  if (sent) {
    await context.auditLogger.record({
      scope: "organization",
      organizationId: context.org.id,
      actorUserId: context.session.user.id,
      action: "order_line.voided",
      targetType: "order_line",
      targetId: line.id,
      metadata: {
        tableSessionId: session.id,
        itemName: line.itemName,
        quantity: line.quantity,
        reason: input.reason ?? null,
        overrideId: input.overrideId,
        approverMemberId,
        recordedByMemberId: memberId,
      },
    });
  }
  return { voided: created, replayed: false };
}

export const orderVoidsRouter = {
  /**
   * Voids an Order line. A sent line needs an Override (`void_line`, target the line id) spent in
   * the same transaction; an unsent line is just removed. Idempotent per key.
   */
  voidLine: orgProcedure
    .use(requirePermission({ order: ["take"] }))
    .input(voidLineInput)
    .handler(async ({ context, input }) => (await voidLineCore(context, input)).voided),

  /**
   * Applies a discount (amount or percent) to a Table session. Always needs an Override
   * (`discount`, target the session id), spent in the same transaction.
   */
  applyDiscount: orgProcedure
    .use(requirePermission({ order: ["take"] }))
    .input(
      z
        .object({
          tableSessionId: z.string().min(1),
          kind: z.enum(DISCOUNT_KINDS),
          value: z.number().int().min(1),
          overrideId: z.string().min(1),
          actingToken: actingTokenInput,
        })
        .refine((input) => input.kind !== "percent" || input.value <= 100, {
          message: "A percent discount is at most 100.",
          path: ["value"],
        }),
    )
    .handler(async ({ context, input }) => {
      const session = await loadSessionInScope(context, input.tableSessionId);
      assertSessionUnsettled(session);
      const memberId = await resolveActingMemberId(context, session.locationId, input.actingToken);

      const created = await context.db.transaction(async (tx) => {
        const { approverMemberId } = await consumeOverride(
          { db: tx, clock: context.clock },
          {
            organizationId: context.org.id,
            actorUserId: context.session.user.id,
            overrideId: input.overrideId,
            locationId: session.locationId,
            action: "discount",
            target: session.id,
          },
        );
        const [inserted] = await tx
          .insert(schema.discount)
          .values({
            organizationId: context.org.id,
            tableSessionId: session.id,
            kind: input.kind,
            value: input.value,
            overrideId: input.overrideId,
            approverMemberId,
            recordedByMemberId: memberId,
            recordedAt: context.clock.now(),
          })
          .returning();
        return inserted!;
      });

      await context.auditLogger.record({
        scope: "organization",
        organizationId: context.org.id,
        actorUserId: context.session.user.id,
        action: "discount.applied",
        targetType: "table_session",
        targetId: session.id,
        metadata: {
          discountId: created.id,
          kind: created.kind,
          value: created.value,
          overrideId: input.overrideId,
          approverMemberId: created.approverMemberId,
          recordedByMemberId: memberId,
        },
      });
      return created;
    }),
};
