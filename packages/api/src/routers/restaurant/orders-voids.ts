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

/** Voids an Order line; a sent line needs an Override spent in the same transaction. Idempotent per key. */
export async function voidLineCore(context: OrderContext, input: VoidLineInput) {
  const { line, session } = await loadLineInScope(context, input.lineId);
  const replay = await findVoidByKey(context, input.idempotencyKey, line.id);
  if (replay) {
    return replay;
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
    });
  }
  const memberId = await resolveActingMemberId(context, session.locationId, input.actingToken);

  const { created, approverMemberId } = await context.db.transaction(async (tx) => {
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
      // Already voided (another key, or a concurrent call): roll back the spent Override.
      throw new ORPCError("CONFLICT", { message: "This line is already voided." });
    }
    return { created: inserted, approverMemberId: approver?.approverMemberId ?? null };
  });

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
  return created;
}

export const orderVoidsRouter = {
  /**
   * Voids an Order line. A sent line needs an Override (`void_line`, target the line id) spent in
   * the same transaction; an unsent line is just removed. Idempotent per key.
   */
  voidLine: orgProcedure
    .use(requirePermission({ order: ["take"] }))
    .input(voidLineInput)
    .handler(({ context, input }) => voidLineCore(context, input)),

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
