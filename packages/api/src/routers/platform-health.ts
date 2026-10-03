import { businessDayBounds, businessDayOf } from "@base-template/db/lib/business-day";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, count, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";

import { platformProcedure } from "../index";
import {
  ACTIVATION_WINDOW_DAYS,
  activationStatus,
  isWeeklyActive,
  weekOf,
} from "../lib/product-health";

const healthProcedure = platformProcedure({ health: ["read"] });
const DAY_MS = 24 * 60 * 60 * 1000;

function badDate(message: string): never {
  throw new ORPCError("BAD_REQUEST", { message });
}

type LocationCounts = Promise<{ locationId: string; total: number }[]>;

async function countsOf(rows: LocationCounts): Promise<Map<string, number>> {
  return new Map((await rows).map((row) => [row.locationId, row.total]));
}

/** See docs/architecture/restaurant.md#product-health */
export const platformHealthRouter = {
  /** Weekly Active Locations: Cash shift closed on 5 or more business days of a Monday to Sunday week. */
  weeklyActive: healthProcedure
    .input(z.object({ date: z.string().optional() }))
    .handler(async ({ context, input }) => {
      let week;
      try {
        week = weekOf(input.date ?? businessDayOf(context.clock.now()));
      } catch {
        return badDate("date must be a valid YYYY-MM-DD date.");
      }
      const closes = await context.db
        .select({
          locationId: schema.cashShift.locationId,
          closedAt: schema.cashShift.closedAt,
          name: schema.location.name,
          organizationId: schema.location.organizationId,
        })
        .from(schema.cashShift)
        .innerJoin(schema.location, eq(schema.location.id, schema.cashShift.locationId))
        .where(
          and(
            gte(schema.cashShift.closedAt, week.bounds.start),
            lt(schema.cashShift.closedAt, week.bounds.end),
          ),
        );
      const days = new Map<
        string,
        { organizationId: string; name: string; closeDays: Set<string> }
      >();
      for (const row of closes) {
        const entry = days.get(row.locationId) ?? {
          organizationId: row.organizationId,
          name: row.name,
          closeDays: new Set<string>(),
        };
        entry.closeDays.add(businessDayOf(row.closedAt!));
        days.set(row.locationId, entry);
      }
      const locations = [...days]
        .map(([locationId, entry]) => ({
          locationId,
          organizationId: entry.organizationId,
          name: entry.name,
          closeDays: entry.closeDays.size,
          active: isWeeklyActive(entry.closeDays.size),
        }))
        .sort(
          (a, b) =>
            b.closeDays - a.closeDays ||
            a.name.localeCompare(b.name) ||
            a.locationId.localeCompare(b.locationId),
        );
      return {
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        activeCount: locations.filter((row) => row.active).length,
        locations,
      };
    }),

  /** Activated Locations among those that signed up in the optional `from` to `to` business days. */
  activated: healthProcedure
    .input(z.object({ from: z.string().optional(), to: z.string().optional() }))
    .handler(async ({ context, input }) => {
      const now = context.clock.now();
      const filters = [];
      try {
        if (input.from) {
          filters.push(gte(schema.location.createdAt, businessDayBounds(input.from).start));
        }
        if (input.to) {
          filters.push(lt(schema.location.createdAt, businessDayBounds(input.to).end));
        }
      } catch {
        return badDate("from and to must be valid YYYY-MM-DD dates.");
      }
      const cohort = await context.db
        .select()
        .from(schema.location)
        .where(and(...filters))
        .orderBy(asc(schema.location.createdAt), asc(schema.location.id));
      const ids = cohort.map((row) => row.id);
      const windowEnd = sql`${schema.location.createdAt} + ${sql.raw(`interval '${ACTIVATION_WINDOW_DAYS} days'`)}`;

      const empty = new Map<string, number>();
      const [bills, shifts, tables, stations, routings] =
        ids.length === 0
          ? [empty, empty, empty, empty, empty]
          : await Promise.all([
              countsOf(
                context.db
                  .select({ locationId: schema.bill.locationId, total: count() })
                  .from(schema.bill)
                  .innerJoin(schema.location, eq(schema.location.id, schema.bill.locationId))
                  .where(
                    and(
                      inArray(schema.bill.locationId, ids),
                      eq(schema.bill.status, "settled"),
                      gte(schema.bill.settledAt, schema.location.createdAt),
                      lt(schema.bill.settledAt, windowEnd),
                    ),
                  )
                  .groupBy(schema.bill.locationId),
              ),
              countsOf(
                context.db
                  .select({ locationId: schema.cashShift.locationId, total: count() })
                  .from(schema.cashShift)
                  .innerJoin(schema.location, eq(schema.location.id, schema.cashShift.locationId))
                  .where(
                    and(
                      inArray(schema.cashShift.locationId, ids),
                      gte(schema.cashShift.closedAt, schema.location.createdAt),
                      lt(schema.cashShift.closedAt, windowEnd),
                    ),
                  )
                  .groupBy(schema.cashShift.locationId),
              ),
              countsOf(
                context.db
                  .select({ locationId: schema.diningTable.locationId, total: count() })
                  .from(schema.diningTable)
                  .innerJoin(schema.location, eq(schema.location.id, schema.diningTable.locationId))
                  .where(
                    and(
                      inArray(schema.diningTable.locationId, ids),
                      lt(schema.diningTable.createdAt, windowEnd),
                    ),
                  )
                  .groupBy(schema.diningTable.locationId),
              ),
              countsOf(
                context.db
                  .select({ locationId: schema.station.locationId, total: count() })
                  .from(schema.station)
                  .innerJoin(schema.location, eq(schema.location.id, schema.station.locationId))
                  .where(
                    and(
                      inArray(schema.station.locationId, ids),
                      lt(schema.station.createdAt, windowEnd),
                    ),
                  )
                  .groupBy(schema.station.locationId),
              ),
              countsOf(
                context.db
                  .select({ locationId: schema.stationRouting.locationId, total: count() })
                  .from(schema.stationRouting)
                  .innerJoin(
                    schema.location,
                    eq(schema.location.id, schema.stationRouting.locationId),
                  )
                  .innerJoin(
                    schema.menuItem,
                    eq(schema.menuItem.id, schema.stationRouting.menuItemId),
                  )
                  .where(
                    and(
                      inArray(schema.stationRouting.locationId, ids),
                      eq(schema.menuItem.active, true),
                      lt(schema.stationRouting.createdAt, windowEnd),
                    ),
                  )
                  .groupBy(schema.stationRouting.locationId),
              ),
            ]);

      const locations = cohort.map((row) => {
        const criteria = {
          setupFinished:
            (tables.get(row.id) ?? 0) > 0 &&
            (stations.get(row.id) ?? 0) > 0 &&
            (routings.get(row.id) ?? 0) > 0,
          settledBills: bills.get(row.id) ?? 0,
          shiftClosed: (shifts.get(row.id) ?? 0) > 0,
        };
        return {
          locationId: row.id,
          organizationId: row.organizationId,
          name: row.name,
          signedUpAt: row.createdAt,
          windowEndsAt: new Date(row.createdAt.getTime() + ACTIVATION_WINDOW_DAYS * DAY_MS),
          status: activationStatus({ signedUpAt: row.createdAt, now, ...criteria }),
          criteria,
        };
      });
      const activatedCount = locations.filter((row) => row.status === "activated").length;
      const notActivatedCount = locations.filter((row) => row.status === "not_activated").length;
      const decided = activatedCount + notActivatedCount;
      return {
        cohortSize: locations.length,
        activatedCount,
        pendingCount: locations.filter((row) => row.status === "pending").length,
        activationRate: decided === 0 ? null : activatedCount / decided,
        locations,
      };
    }),
};
