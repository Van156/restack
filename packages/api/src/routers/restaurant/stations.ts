import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { assertLocationAccess } from "../../lib/location-scope";
import type { LocationScopeContext } from "../../lib/location-scope";
import { definedFields, orConflict } from "./setup-helpers";

const name = z.string().trim().min(1).max(80);
const output = z.enum(["kitchen_display", "printer"]);
const NAME_TAKEN = "A Station with this name already exists in this Location.";

function rejectPrinter(value: z.infer<typeof output> | undefined) {
  if (value === "printer") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Printer output is not available yet (Later). Use kitchen display.",
    });
  }
}

/** Loads a Station of the caller's organization and checks the caller may act in its Location. */
export async function loadStationInScope(context: LocationScopeContext, stationId: string) {
  const [row] = await context.db
    .select()
    .from(schema.station)
    .where(
      and(eq(schema.station.id, stationId), eq(schema.station.organizationId, context.org.id)),
    );
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Station not found." });
  }
  await assertLocationAccess(context, row.locationId);
  return row;
}

export const stationsRouter = {
  /** Stations of a Location with how many Menu items are routed to each. */
  list: orgProcedure
    .input(z.object({ locationId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      return context.db
        .select({
          id: schema.station.id,
          locationId: schema.station.locationId,
          name: schema.station.name,
          output: schema.station.output,
          routedItemCount: count(schema.stationRouting.id),
        })
        .from(schema.station)
        .leftJoin(schema.stationRouting, eq(schema.stationRouting.stationId, schema.station.id))
        .where(
          and(
            eq(schema.station.locationId, input.locationId),
            eq(schema.station.organizationId, context.org.id),
          ),
        )
        .groupBy(schema.station.id)
        .orderBy(asc(schema.station.name));
    }),

  create: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(z.object({ locationId: z.string().min(1), name, output: output.optional() }))
    .handler(async ({ context, input }) => {
      rejectPrinter(input.output);
      await assertLocationAccess(context, input.locationId);
      const [created] = await orConflict(NAME_TAKEN, () =>
        context.db
          .insert(schema.station)
          .values({
            organizationId: context.org.id,
            locationId: input.locationId,
            name: input.name,
            output: "kitchen_display",
          })
          .returning(),
      );
      return created!;
    }),

  update: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(
      z.object({ stationId: z.string().min(1), name: name.optional(), output: output.optional() }),
    )
    .handler(async ({ context, input }) => {
      rejectPrinter(input.output);
      const station = await loadStationInScope(context, input.stationId);
      const changes = definedFields({ name: input.name, output: input.output });
      if (Object.keys(changes).length === 0) {
        throw new ORPCError("BAD_REQUEST", { message: "Nothing to update." });
      }
      const [updated] = await orConflict(NAME_TAKEN, () =>
        context.db
          .update(schema.station)
          .set(changes)
          .where(eq(schema.station.id, station.id))
          .returning(),
      );
      return updated!;
    }),

  /** Blocked while any Menu item is routed to the Station, so no dish loses its destination. */
  delete: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(z.object({ stationId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const station = await loadStationInScope(context, input.stationId);
      const [routed] = await context.db
        .select({ value: count() })
        .from(schema.stationRouting)
        .where(eq(schema.stationRouting.stationId, station.id));
      if ((routed?.value ?? 0) > 0) {
        throw new ORPCError("CONFLICT", {
          message: `This Station still has ${routed!.value} Menu item(s) routed to it. Route them elsewhere first.`,
        });
      }
      await context.db.delete(schema.station).where(eq(schema.station.id, station.id));
      return { deleted: true };
    }),
};
