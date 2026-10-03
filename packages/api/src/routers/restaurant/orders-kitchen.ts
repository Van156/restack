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

export const orderKitchenRouter = {
  /**
   * Sends every unsent, unvoided line to the kitchen as one Ticket per Station. Blocked as a whole
   * when an item has no Station here; with nothing new it returns no Tickets.
   */
  sendToKitchen: orgProcedure
    .use(requirePermission({ order: ["take"] }))
    .input(z.object({ tableSessionId: z.string().min(1), actingToken: actingTokenInput }))
    .handler(async ({ context, input }) => {
      const session = await loadSessionInScope(context, input.tableSessionId);
      assertSessionUnsettled(session);
      const memberId = await resolveActingMemberId(context, session.locationId, input.actingToken);

      return context.db.transaction(async (tx) => {
        // Serializes concurrent sends of the same session so no line lands on two Tickets.
        await tx
          .select({ id: schema.tableSession.id })
          .from(schema.tableSession)
          .where(eq(schema.tableSession.id, session.id))
          .for("update");

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
          return { tickets: [] };
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
        const stationOf = new Map(
          routings.map((routing) => [routing.menuItemId, routing.stationId]),
        );

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
          });
        }

        const linesByStation = new Map<string, string[]>();
        for (const { line } of unsent) {
          const stationId = stationOf.get(line.menuItemId!)!;
          linesByStation.set(stationId, [...(linesByStation.get(stationId) ?? []), line.id]);
        }

        const sentAt = context.clock.now();
        const tickets = [];
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
            })
            .returning();
          await tx
            .insert(schema.ticketLine)
            .values(lineIds.map((orderLineId) => ({ ticketId: created!.id, orderLineId })));
          tickets.push({ ...created!, lineIds });
        }
        return { tickets };
      });
    }),
};
