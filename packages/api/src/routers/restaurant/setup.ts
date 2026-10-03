import * as schema from "@base-template/db/schema";
import { and, asc, count, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { assertLocationAccess } from "../../lib/location-scope";

export const setupRouter = {
  /**
   * The "Revisar" step: setup mistakes to fix before service at one Location, plus the static
   * reminders the UI renders (`advertencia_propina`: tip signage required by Ley 1935 de 2018).
   */
  review: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(z.object({ locationId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const location = await assertLocationAccess(context, input.locationId);

      const unroutedMenuItems = await context.db
        .select({ id: schema.menuItem.id, name: schema.menuItem.name })
        .from(schema.menuItem)
        .leftJoin(
          schema.stationRouting,
          and(
            eq(schema.stationRouting.menuItemId, schema.menuItem.id),
            eq(schema.stationRouting.locationId, input.locationId),
          ),
        )
        .where(
          and(
            eq(schema.menuItem.organizationId, context.org.id),
            eq(schema.menuItem.active, true),
            isNull(schema.stationRouting.id),
          ),
        )
        .orderBy(asc(schema.menuItem.name));

      const emptyAreas = await context.db
        .select({ id: schema.area.id, name: schema.area.name })
        .from(schema.area)
        .leftJoin(schema.diningTable, eq(schema.diningTable.areaId, schema.area.id))
        .where(
          and(
            eq(schema.area.locationId, input.locationId),
            eq(schema.area.organizationId, context.org.id),
          ),
        )
        .groupBy(schema.area.id)
        .having(sql`${count(schema.diningTable.id)} = 0`)
        .orderBy(asc(schema.area.sortOrder), asc(schema.area.name));

      const idleStations = await context.db
        .select({ id: schema.station.id, name: schema.station.name })
        .from(schema.station)
        .leftJoin(schema.stationRouting, eq(schema.stationRouting.stationId, schema.station.id))
        .where(
          and(
            eq(schema.station.locationId, input.locationId),
            eq(schema.station.organizationId, context.org.id),
          ),
        )
        .groupBy(schema.station.id)
        .having(sql`${count(schema.stationRouting.id)} = 0`)
        .orderBy(asc(schema.station.name));

      const missingNit = !location.nit;

      return {
        unroutedMenuItems,
        emptyAreas,
        idleStations,
        missingNit,
        warningCount:
          unroutedMenuItems.length + emptyAreas.length + idleStations.length + Number(missingNit),
        reminders: ["advertencia_propina"] as const,
      };
    }),
};
