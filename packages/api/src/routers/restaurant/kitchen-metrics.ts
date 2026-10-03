import * as schema from "@base-template/db/schema";
import { businessDayBounds, businessDayOf } from "@base-template/db/lib/business-day";
import { ORPCError } from "@orpc/server";
import { and, eq, gte, lt } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { assertLocationAccess } from "../../lib/location-scope";
import { loadStationAt } from "./kitchen-access";

type TimedTicket = {
  startedAt: Date | null;
  readyAt: Date | null;
  deliveredAt: Date | null;
};

type TimingSummary = {
  ticketCount: number;
  /** Tickets already delivered. */
  completedCount: number;
  avgPrepMs: number | null;
  maxPrepMs: number | null;
  avgPickupMs: number | null;
  maxPickupMs: number | null;
};

function stats(durations: number[]): {
  avg: number | null;
  max: number | null;
} {
  if (durations.length === 0) {
    return { avg: null, max: null };
  }
  const sum = durations.reduce((total, value) => total + value, 0);
  return {
    avg: Math.round(sum / durations.length),
    max: Math.max(...durations),
  };
}

/** Preparation time is started to ready; pickup wait is ready to delivered. */
function summarize(tickets: TimedTicket[]): TimingSummary {
  const prep = stats(
    tickets.flatMap((t) =>
      t.startedAt && t.readyAt ? [t.readyAt.getTime() - t.startedAt.getTime()] : [],
    ),
  );
  const pickup = stats(
    tickets.flatMap((t) =>
      t.readyAt && t.deliveredAt ? [t.deliveredAt.getTime() - t.readyAt.getTime()] : [],
    ),
  );
  return {
    ticketCount: tickets.length,
    completedCount: tickets.filter((t) => t.deliveredAt).length,
    avgPrepMs: prep.avg,
    maxPrepMs: prep.max,
    avgPickupMs: pickup.avg,
    maxPickupMs: pickup.max,
  };
}

export const kitchenMetricsRouter = {
  /** Preparation time and pickup wait per Station for the business day Tickets were sent. */
  metrics: orgProcedure
    .use(requirePermission({ report: ["read"] }))
    .input(
      z.object({
        locationId: z.string().min(1),
        stationId: z.string().min(1).optional(),
        date: z.string().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      if (input.stationId) {
        await loadStationAt(context.db, context.org.id, input.locationId, input.stationId);
      }
      let bounds;
      try {
        bounds = businessDayBounds(input.date ?? businessDayOf(context.clock.now()));
      } catch {
        throw new ORPCError("BAD_REQUEST", {
          message: "date must be a valid YYYY-MM-DD date.",
        });
      }

      const filters: SQL[] = [
        eq(schema.ticket.organizationId, context.org.id),
        eq(schema.ticket.locationId, input.locationId),
        gte(schema.ticket.sentAt, bounds.start),
        lt(schema.ticket.sentAt, bounds.end),
      ];
      if (input.stationId) {
        filters.push(eq(schema.ticket.stationId, input.stationId));
      }
      const rows = await context.db
        .select({ ticket: schema.ticket, stationName: schema.station.name })
        .from(schema.ticket)
        .innerJoin(schema.station, eq(schema.station.id, schema.ticket.stationId))
        .where(and(...filters));

      const byStation = new Map<string, { name: string; tickets: TimedTicket[] }>();
      for (const { ticket, stationName } of rows) {
        const entry = byStation.get(ticket.stationId) ?? {
          name: stationName,
          tickets: [],
        };
        entry.tickets.push(ticket);
        byStation.set(ticket.stationId, entry);
      }
      return {
        date: input.date ?? businessDayOf(context.clock.now()),
        total: summarize(rows.map((row) => row.ticket)),
        stations: [...byStation]
          .map(([stationId, entry]) => ({
            stationId,
            stationName: entry.name,
            ...summarize(entry.tickets),
          }))
          .sort((a, b) => a.stationName.localeCompare(b.stationName)),
      };
    }),
};
