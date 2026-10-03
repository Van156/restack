import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
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
import type { OrderContext, OrderLineRow } from "./orders-shared";

/** The Order line recorded under this idempotency key, if any. */
export async function findLineByKey(
  context: OrderContext,
  key: string,
): Promise<OrderLineRow | undefined> {
  const [row] = await context.db
    .select()
    .from(schema.orderLine)
    .where(
      and(
        eq(schema.orderLine.organizationId, context.org.id),
        eq(schema.orderLine.idempotencyKey, key),
      ),
    );
  return row;
}

/** Resolves chosen modifiers into the line snapshot; ids and selection counts must fit the item. */
async function snapshotModifiers(
  context: OrderContext,
  menuItemId: string,
  modifierIds: string[],
): Promise<schema.OrderLineModifier[]> {
  const groups = await context.db
    .select()
    .from(schema.modifierGroup)
    .where(eq(schema.modifierGroup.menuItemId, menuItemId))
    .orderBy(asc(schema.modifierGroup.sortOrder), asc(schema.modifierGroup.name));
  const options =
    groups.length === 0
      ? []
      : await context.db
          .select()
          .from(schema.modifier)
          .where(
            inArray(
              schema.modifier.groupId,
              groups.map((group) => group.id),
            ),
          );
  const requested = [...new Set(modifierIds)];
  const chosen = requested.map((id) => options.find((option) => option.id === id));
  if (chosen.some((option) => !option)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "A modifier does not belong to this Menu item.",
    });
  }
  for (const group of groups) {
    const count = chosen.filter((option) => option!.groupId === group.id).length;
    if (count < group.minSelect || count > group.maxSelect) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Choose between ${group.minSelect} and ${group.maxSelect} for "${group.name}".`,
      });
    }
  }
  return chosen.map((option) => ({
    modifierId: option!.id,
    name: option!.name,
    priceDelta: option!.priceDelta,
  }));
}

export const addLineInput = z.object({
  tableSessionId: z.string().min(1),
  menuItemId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
  modifierIds: z.array(z.string().min(1)).max(50).default([]),
  note: z.string().trim().min(1).max(200).optional(),
  idempotencyKey,
  clientRecordedAt: z.date().optional(),
  actingToken: actingTokenInput,
});
export type AddLineInput = z.infer<typeof addLineInput>;

/** Prices a device recorded; they win over the current Menu (see `docs/architecture/restaurant.md#sync`). */
export type RecordedPrices = {
  unitPrice: number;
  modifierPriceDeltas: Record<string, number>;
};

/**
 * Appends an Order line; `recorded` (a synced offline line) keeps the device prices and skips the
 * availability guards. `replayed` is true for a repeated key. See docs/architecture/restaurant.md#sync.
 */
export async function addLineCore(
  context: OrderContext,
  input: AddLineInput,
  recorded?: RecordedPrices,
): Promise<{ line: OrderLineRow; replayed: boolean }> {
  const session = await loadSessionInScope(context, input.tableSessionId);
  const replay = await findLineByKey(context, input.idempotencyKey);
  if (replay) {
    if (replay.tableSessionId !== session.id) {
      throw new ORPCError("CONFLICT", {
        message: "This idempotency key was already used for another Table session.",
      });
    }
    return { line: replay, replayed: true };
  }
  assertSessionUnsettled(session);

  const [item] = await context.db
    .select()
    .from(schema.menuItem)
    .where(
      and(
        eq(schema.menuItem.id, input.menuItemId),
        eq(schema.menuItem.organizationId, context.org.id),
      ),
    );
  if (!item) {
    throw new ORPCError("NOT_FOUND", { message: "Menu item not found." });
  }
  if (!recorded) {
    if (!item.active) {
      throw new ORPCError("BAD_REQUEST", { message: "This Menu item is not active." });
    }
    const [availability] = await context.db
      .select({ soldOut: schema.menuItemAvailability.soldOut })
      .from(schema.menuItemAvailability)
      .where(
        and(
          eq(schema.menuItemAvailability.locationId, session.locationId),
          eq(schema.menuItemAvailability.menuItemId, item.id),
        ),
      );
    if (availability?.soldOut) {
      throw new ORPCError("CONFLICT", {
        message: `"${item.name}" is sold out at this Location.`,
      });
    }
  }
  const menuModifiers = await snapshotModifiers(context, item.id, input.modifierIds);
  const modifiers = recorded
    ? menuModifiers.map((modifier) => ({
        ...modifier,
        priceDelta: recorded.modifierPriceDeltas[modifier.modifierId] ?? modifier.priceDelta,
      }))
    : menuModifiers;
  const memberId = await resolveActingMemberId(context, session.locationId, input.actingToken);

  const [created] = await context.db
    .insert(schema.orderLine)
    .values({
      organizationId: context.org.id,
      locationId: session.locationId,
      tableSessionId: session.id,
      menuItemId: item.id,
      itemName: item.name,
      unitPrice: recorded?.unitPrice ?? item.price,
      taxClass: item.taxClass,
      modifiers,
      quantity: input.quantity,
      note: input.note ?? null,
      recordedByMemberId: memberId,
      clientRecordedAt: input.clientRecordedAt ?? null,
      recordedAt: context.clock.now(),
      idempotencyKey: input.idempotencyKey,
    })
    .onConflictDoNothing({
      target: [schema.orderLine.organizationId, schema.orderLine.idempotencyKey],
    })
    .returning();
  // A concurrent request with the same key won the race: return its line as a replay.
  return created
    ? { line: created, replayed: false }
    : { line: (await findLineByKey(context, input.idempotencyKey))!, replayed: true };
}

export const removeLineInput = z.object({
  lineId: z.string().min(1),
  reason: z.string().trim().min(1).max(200).optional(),
  idempotencyKey,
  actingToken: actingTokenInput,
});
export type RemoveLineInput = z.infer<typeof removeLineInput>;

/** Removes an unsent line as a void record (no Override). Idempotent per key. */
export async function removeLineCore(context: OrderContext, input: RemoveLineInput) {
  const { line, session } = await loadLineInScope(context, input.lineId);
  const replay = await findVoidByKey(context, input.idempotencyKey, line.id);
  if (replay) {
    return replay;
  }
  assertSessionUnsettled(session);
  if (await isLineSent(context, line.id)) {
    throw new ORPCError("CONFLICT", {
      message: "This line was sent to the kitchen; voiding it needs an Override.",
    });
  }
  const memberId = await resolveActingMemberId(context, session.locationId, input.actingToken);
  const [created] = await context.db
    .insert(schema.orderLineVoid)
    .values({
      organizationId: context.org.id,
      orderLineId: line.id,
      reason: input.reason ?? null,
      recordedByMemberId: memberId,
      recordedAt: context.clock.now(),
      idempotencyKey: input.idempotencyKey,
    })
    .onConflictDoNothing()
    .returning();
  if (created) {
    return created;
  }
  const [existing] = await context.db
    .select()
    .from(schema.orderLineVoid)
    .where(eq(schema.orderLineVoid.orderLineId, line.id));
  return existing!;
}

export const orderLinesRouter = {
  /** The session with its lines (voided flagged), Tickets with their line ids, and discounts. */
  getSession: orgProcedure
    .input(z.object({ tableSessionId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const session = await loadSessionInScope(context, input.tableSessionId);
      const lineRows = await context.db
        .select({
          line: schema.orderLine,
          voidId: schema.orderLineVoid.id,
          ticketId: schema.ticketLine.ticketId,
        })
        .from(schema.orderLine)
        .leftJoin(schema.orderLineVoid, eq(schema.orderLineVoid.orderLineId, schema.orderLine.id))
        .leftJoin(schema.ticketLine, eq(schema.ticketLine.orderLineId, schema.orderLine.id))
        .where(eq(schema.orderLine.tableSessionId, session.id))
        .orderBy(asc(schema.orderLine.recordedAt), asc(schema.orderLine.createdAt));
      const ticketRows = await context.db
        .select()
        .from(schema.ticket)
        .where(eq(schema.ticket.tableSessionId, session.id))
        .orderBy(asc(schema.ticket.sentAt));
      const discounts = await context.db
        .select()
        .from(schema.discount)
        .where(eq(schema.discount.tableSessionId, session.id))
        .orderBy(asc(schema.discount.recordedAt));
      const ticketLines = new Map<string, string[]>();
      for (const row of lineRows) {
        if (row.ticketId) {
          ticketLines.set(row.ticketId, [...(ticketLines.get(row.ticketId) ?? []), row.line.id]);
        }
      }
      return {
        session,
        lines: lineRows.map((row) => ({
          ...row.line,
          voided: row.voidId !== null,
          ticketId: row.ticketId,
        })),
        tickets: ticketRows.map((row) => ({ ...row, lineIds: ticketLines.get(row.id) ?? [] })),
        discounts,
      };
    }),

  /**
   * Appends an Order line, copying price and modifier deltas. The idempotency key makes a retry
   * return the existing line, even after sell-out; sold-out items are refused.
   */
  addLine: orgProcedure
    .use(requirePermission({ order: ["take"] }))
    .input(addLineInput)
    .handler(async ({ context, input }) => (await addLineCore(context, input)).line),

  /** Removes an unsent line (a void record, no Override); sent lines need `voidLine`. Idempotent. */
  removeLine: orgProcedure
    .use(requirePermission({ order: ["take"] }))
    .input(removeLineInput)
    .handler(({ context, input }) => removeLineCore(context, input)),
};
