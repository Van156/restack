import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { businessDayBounds, businessDayOf } from "@base-template/db/lib/business-day";
import type { TicketStatus } from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, gte, inArray, ne, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

import { assertKitchenAccess, kitchenProcedure, loadStationAt } from "./kitchen-access";
import type { KitchenCaller } from "./kitchen-access";
import { kitchenMetricsRouter } from "./kitchen-metrics";

const locationIdInput = z.string().min(1).optional();
const stationIdInput = z.string().min(1).optional();

/** Each status a Ticket can advance to, the one it must come from and its timestamp column. */
const TRANSITIONS = {
  preparando: { from: "nuevo", column: "startedAt" },
  listo: { from: "preparando", column: "readyAt" },
  entregado: { from: "listo", column: "deliveredAt" },
} as const satisfies Record<string, { from: TicketStatus; column: string }>;

/** The Location and Stations a list call covers; `null` stations means every Station there. */
async function resolveListScope(
  db: Database,
  caller: KitchenCaller,
  input: { locationId?: string; stationId?: string },
): Promise<{ locationId: string; stationIds: string[] | null }> {
  if (caller.kind === "device") {
    const { device } = caller;
    const locationId = input.locationId ?? device.locationId;
    await assertKitchenAccess(db, caller, {
      locationId,
      stationId: input.stationId,
    });
    return {
      locationId,
      stationIds: input.stationId ? [input.stationId] : device.stationIds,
    };
  }
  if (!input.locationId) {
    throw new ORPCError("BAD_REQUEST", { message: "A Location is required." });
  }
  await assertKitchenAccess(db, caller, { locationId: input.locationId });
  if (input.stationId) {
    await loadStationAt(db, caller.organizationId, input.locationId, input.stationId);
  }
  return {
    locationId: input.locationId,
    stationIds: input.stationId ? [input.stationId] : null,
  };
}

export const kitchenRouter = {
  /**
   * Tickets of a Paired device's Stations, or of a Location (optionally one Station) for Staff.
   * Unfinished Tickets always show; delivered ones only for the current business day. Voided sent
   * lines are flagged, not hidden, and no prices are returned.
   */
  list: kitchenProcedure
    .input(z.object({ locationId: locationIdInput, stationId: stationIdInput }))
    .handler(async ({ context, input }) => {
      const { db, caller } = context;
      const scope = await resolveListScope(db, caller, input);
      const now = context.clock.now();
      const dayStart = businessDayBounds(businessDayOf(now)).start;

      const filters: SQL[] = [
        eq(schema.ticket.organizationId, caller.organizationId),
        eq(schema.ticket.locationId, scope.locationId),
        or(ne(schema.ticket.status, "entregado"), gte(schema.ticket.deliveredAt, dayStart))!,
      ];
      if (scope.stationIds) {
        filters.push(inArray(schema.ticket.stationId, scope.stationIds));
      }
      const rows = await db
        .select({
          ticket: schema.ticket,
          stationName: schema.station.name,
          tableName: schema.diningTable.name,
          sentByName: schema.user.name,
        })
        .from(schema.ticket)
        .innerJoin(schema.station, eq(schema.station.id, schema.ticket.stationId))
        .innerJoin(schema.tableSession, eq(schema.tableSession.id, schema.ticket.tableSessionId))
        .innerJoin(schema.diningTable, eq(schema.diningTable.id, schema.tableSession.tableId))
        .leftJoin(schema.member, eq(schema.member.id, schema.ticket.sentByMemberId))
        .leftJoin(schema.user, eq(schema.user.id, schema.member.userId))
        .where(and(...filters))
        .orderBy(asc(schema.ticket.sentAt), asc(schema.ticket.id));
      if (rows.length === 0) {
        return [];
      }

      const lineRows = await db
        .select({
          ticketId: schema.ticketLine.ticketId,
          orderLineId: schema.orderLine.id,
          itemName: schema.orderLine.itemName,
          quantity: schema.orderLine.quantity,
          modifiers: schema.orderLine.modifiers,
          note: schema.orderLine.note,
          voidId: schema.orderLineVoid.id,
        })
        .from(schema.ticketLine)
        .innerJoin(schema.orderLine, eq(schema.orderLine.id, schema.ticketLine.orderLineId))
        .leftJoin(schema.orderLineVoid, eq(schema.orderLineVoid.orderLineId, schema.orderLine.id))
        .where(
          inArray(
            schema.ticketLine.ticketId,
            rows.map((row) => row.ticket.id),
          ),
        )
        .orderBy(asc(schema.orderLine.recordedAt), asc(schema.orderLine.id));

      return rows.map(({ ticket, stationName, tableName, sentByName }) => ({
        id: ticket.id,
        status: ticket.status,
        stationId: ticket.stationId,
        stationName,
        tableSessionId: ticket.tableSessionId,
        tableName,
        sentByName,
        sentAt: ticket.sentAt,
        startedAt: ticket.startedAt,
        readyAt: ticket.readyAt,
        deliveredAt: ticket.deliveredAt,
        ageMs: now.getTime() - ticket.sentAt.getTime(),
        lines: lineRows
          .filter((line) => line.ticketId === ticket.id)
          .map((line) => ({
            orderLineId: line.orderLineId,
            itemName: line.itemName,
            quantity: line.quantity,
            modifiers: line.modifiers.map(({ modifierId, name }) => ({
              modifierId,
              name,
            })),
            note: line.note,
            voided: line.voidId !== null,
          })),
      }));
    }),

  /**
   * Moves a Ticket one step forward to `status` and stamps the transition. Repeating the step
   * just taken is a no-op; skipping or going back is CONFLICT. A device only reaches its Stations.
   */
  advance: kitchenProcedure
    .input(
      z.object({
        ticketId: z.string().min(1),
        status: z.enum(["preparando", "listo", "entregado"]),
      }),
    )
    .handler(async ({ context, input }) => {
      const { db, caller } = context;
      const [found] = await db
        .select()
        .from(schema.ticket)
        .where(
          and(
            eq(schema.ticket.id, input.ticketId),
            eq(schema.ticket.organizationId, caller.organizationId),
          ),
        );
      const reachable =
        found &&
        (caller.kind !== "device" ||
          (found.locationId === caller.device.locationId &&
            caller.device.stationIds.includes(found.stationId)));
      if (!found || !reachable) {
        throw new ORPCError("NOT_FOUND", { message: "Ticket not found." });
      }
      await assertKitchenAccess(db, caller, { locationId: found.locationId });

      const step = TRANSITIONS[input.status];
      const [moved] = await db
        .update(schema.ticket)
        .set({ status: input.status, [step.column]: context.clock.now() })
        .where(and(eq(schema.ticket.id, found.id), eq(schema.ticket.status, step.from)))
        .returning();
      if (moved) {
        return moved;
      }
      const [current] = await db.select().from(schema.ticket).where(eq(schema.ticket.id, found.id));
      if (current?.status === input.status) {
        return current;
      }
      throw new ORPCError("CONFLICT", {
        message: `A Ticket ${current?.status ?? "unknown"} cannot move to ${input.status}.`,
      });
    }),

  ...kitchenMetricsRouter,
};
