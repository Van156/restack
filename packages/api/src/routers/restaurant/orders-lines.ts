import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import {
  actingTokenInput,
  assertSessionUnsettled,
  loadSessionInScope,
  resolveActingMemberId,
} from "./orders-shared";
import type { OrderContext } from "./orders-shared";

const idempotencyKey = z.string().trim().min(1).max(100);

type OrderLineRow = typeof schema.orderLine.$inferSelect;

async function findLineByKey(
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

/**
 * Resolves the chosen modifiers of a Menu item into the snapshot stored on the line. Every id must
 * belong to the item and every group's selection count must sit within its limits.
 */
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

export const orderLinesRouter = {
  /**
   * The session with its lines (voided ones flagged, `ticketId` set once sent), Tickets with the
   * ids of their lines, and discounts. Any member with access to the Location may read.
   */
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
   * Appends an Order line. The Menu item's price and modifier deltas are copied onto the line and
   * never recomputed. The idempotency key makes a client retry return the existing line (also
   * after the item sold out meanwhile). Sold-out items are refused for this Location.
   */
  addLine: orgProcedure
    .use(requirePermission({ order: ["take"] }))
    .input(
      z.object({
        tableSessionId: z.string().min(1),
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
        modifierIds: z.array(z.string().min(1)).max(50).default([]),
        note: z.string().trim().min(1).max(200).optional(),
        idempotencyKey,
        clientRecordedAt: z.date().optional(),
        actingToken: actingTokenInput,
      }),
    )
    .handler(async ({ context, input }) => {
      const session = await loadSessionInScope(context, input.tableSessionId);
      const replay = await findLineByKey(context, input.idempotencyKey);
      if (replay) {
        if (replay.tableSessionId !== session.id) {
          throw new ORPCError("CONFLICT", {
            message: "This idempotency key was already used for another Table session.",
          });
        }
        return replay;
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
      const modifiers = await snapshotModifiers(context, item.id, input.modifierIds);
      const memberId = await resolveActingMemberId(context, session.locationId, input.actingToken);

      const [created] = await context.db
        .insert(schema.orderLine)
        .values({
          organizationId: context.org.id,
          locationId: session.locationId,
          tableSessionId: session.id,
          menuItemId: item.id,
          itemName: item.name,
          unitPrice: item.price,
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
      // A concurrent request with the same key won the race: return its line.
      return created ?? (await findLineByKey(context, input.idempotencyKey))!;
    }),

  /**
   * Removes a line that has not been sent to the kitchen, as a void record without an Override.
   * Sent lines need `voidLine` with an Override. Repeating the call with the same key is a no-op.
   */
  removeLine: orgProcedure
    .use(requirePermission({ order: ["take"] }))
    .input(
      z.object({
        lineId: z.string().min(1),
        reason: z.string().trim().min(1).max(200).optional(),
        idempotencyKey,
        actingToken: actingTokenInput,
      }),
    )
    .handler(async ({ context, input }) => {
      const [line] = await context.db
        .select()
        .from(schema.orderLine)
        .where(
          and(
            eq(schema.orderLine.id, input.lineId),
            eq(schema.orderLine.organizationId, context.org.id),
          ),
        );
      if (!line) {
        throw new ORPCError("NOT_FOUND", { message: "Order line not found." });
      }
      const session = await loadSessionInScope(context, line.tableSessionId);

      const [replay] = await context.db
        .select()
        .from(schema.orderLineVoid)
        .where(
          and(
            eq(schema.orderLineVoid.organizationId, context.org.id),
            eq(schema.orderLineVoid.idempotencyKey, input.idempotencyKey),
          ),
        );
      if (replay) {
        if (replay.orderLineId !== line.id) {
          throw new ORPCError("CONFLICT", { message: "This idempotency key was already used." });
        }
        return replay;
      }
      assertSessionUnsettled(session);

      const [sent] = await context.db
        .select({ ticketId: schema.ticketLine.ticketId })
        .from(schema.ticketLine)
        .where(eq(schema.ticketLine.orderLineId, line.id));
      if (sent) {
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
    }),
};
