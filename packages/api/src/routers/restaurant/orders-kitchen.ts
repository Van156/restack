import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import {
  actingTokenInput,
  assertSessionUnsettled,
  loadSessionInScope,
  resolveActingMemberId,
} from "./orders-shared";
import type { OrderContext } from "./orders-shared";

/** `data.reason` of the rejection raised when an unsent item has no Station at the Location. */
export const UNROUTED_ITEMS = "unrouted_items";

const NOTHING_SENT: { tickets: never[]; replayed: false } = { tickets: [], replayed: false };

export type SentTicket = typeof schema.ticket.$inferSelect & { lineIds: string[] };

/**
 * Sends every unsent, unvoided line of a session as one Ticket per Station, in one transaction
 * that locks the session so no line lands on two Tickets. A synced send passes its `sendKey` and
 * the device time as `sentAt`: replaying the key returns its Tickets with `replayed`, decided
 * under the lock. Blocked as a whole when an item has no Station here.
 */
export async function sendToKitchenCore(
  context: OrderContext,
  input: { tableSessionId: string; actingToken?: string; sentAt?: Date; sendKey?: string },
): Promise<{ tickets: SentTicket[]; replayed: boolean }> {
  const session = await loadSessionInScope(context, input.tableSessionId);
  const memberId = await resolveActingMemberId(context, session.locationId, input.actingToken);

  return context.db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ status: schema.tableSession.status })
      .from(schema.tableSession)
      .where(eq(schema.tableSession.id, session.id))
      .for("update");

    if (input.sendKey) {
      const earlier = await tx
        .select()
        .from(schema.ticket)
        .where(
          and(
            eq(schema.ticket.organizationId, context.org.id),
            eq(schema.ticket.sendKey, input.sendKey),
          ),
        );
      if (earlier.length > 0) {
        if (earlier.some((row) => row.tableSessionId !== session.id)) {
          throw new ORPCError("CONFLICT", { message: "This idempotency key was already used." });
        }
        return {
          tickets: await withLineIds(tx, earlier),
          replayed: true,
        };
      }
    }
    assertSessionUnsettled({ ...session, status: locked!.status });

    const unsent = await tx
      .select({ line: schema.orderLine })
      .from(schema.orderLine)
      .leftJoin(schema.orderLineVoid, eq(schema.orderLineVoid.orderLineId, schema.orderLine.id))
      .leftJoin(schema.ticketLine, eq(schema.ticketLine.orderLineId, schema.orderLine.id))
      .where(
        and(
          eq(schema.orderLine.tableSessionId, session.id),
          isNull(schema.orderLineVoid.id),
          isNull(schema.ticketLine.orderLineId),
        ),
      );
    if (unsent.length === 0) {
      return NOTHING_SENT;
    }

    const itemIds = [
      ...new Set(unsent.flatMap((row) => (row.line.menuItemId ? [row.line.menuItemId] : []))),
    ];
    const routings =
      itemIds.length === 0
        ? []
        : await tx
            .select()
            .from(schema.stationRouting)
            .where(
              and(
                eq(schema.stationRouting.locationId, session.locationId),
                inArray(schema.stationRouting.menuItemId, itemIds),
              ),
            );
    const stationOf = new Map(routings.map((routing) => [routing.menuItemId, routing.stationId]));

    const unrouted = [
      ...new Set(
        unsent
          .filter((row) => !row.line.menuItemId || !stationOf.has(row.line.menuItemId))
          .map((row) => row.line.itemName),
      ),
    ];
    if (unrouted.length > 0) {
      throw new ORPCError("CONFLICT", {
        message: `No Station at this Location prepares: ${unrouted.join(", ")}.`,
        data: { reason: UNROUTED_ITEMS, items: unrouted },
      });
    }

    const linesByStation = new Map<string, string[]>();
    for (const { line } of unsent) {
      const stationId = stationOf.get(line.menuItemId!)!;
      linesByStation.set(stationId, [...(linesByStation.get(stationId) ?? []), line.id]);
    }

    const sentAt = input.sentAt ?? context.clock.now();
    const tickets: SentTicket[] = [];
    for (const [stationId, lineIds] of linesByStation) {
      const [created] = await tx
        .insert(schema.ticket)
        .values({
          organizationId: context.org.id,
          locationId: session.locationId,
          tableSessionId: session.id,
          stationId,
          sentByMemberId: memberId,
          sentAt,
          sendKey: input.sendKey,
        })
        .returning();
      await tx
        .insert(schema.ticketLine)
        .values(lineIds.map((orderLineId) => ({ ticketId: created!.id, orderLineId })));
      tickets.push({ ...created!, lineIds });
    }
    return { tickets, replayed: false };
  });
}

async function withLineIds(
  db: Pick<OrderContext["db"], "select">,
  tickets: (typeof schema.ticket.$inferSelect)[],
): Promise<SentTicket[]> {
  const lines = await db
    .select()
    .from(schema.ticketLine)
    .where(
      inArray(
        schema.ticketLine.ticketId,
        tickets.map((row) => row.id),
      ),
    );
  return tickets.map((row) => ({
    ...row,
    lineIds: lines.filter((line) => line.ticketId === row.id).map((line) => line.orderLineId),
  }));
}

export const orderKitchenRouter = {
  /**
   * Sends every unsent, unvoided line to the kitchen as one Ticket per Station. Blocked as a whole
   * when an item has no Station here; with nothing new it returns no Tickets.
   */
  sendToKitchen: orgProcedure
    .use(requirePermission({ order: ["take"] }))
    .input(z.object({ tableSessionId: z.string().min(1), actingToken: actingTokenInput }))
    .handler(async ({ context, input }) => {
      const { tickets } = await sendToKitchenCore(context, input);
      return { tickets };
    }),
};
