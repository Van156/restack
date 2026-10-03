import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, max } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { assertLocationAccess } from "../../lib/location-scope";
import type { LocationScopeContext } from "../../lib/location-scope";
import { hasOpenBillsInArea } from "../../lib/table-session";
import { definedFields, orConflict, orRestricted } from "./setup-helpers";

const name = z.string().trim().min(1).max(80);

/** Loads an Area of the caller's organization and checks the caller may act in its Location. */
export async function loadAreaInScope(context: LocationScopeContext, areaId: string) {
  const [row] = await context.db
    .select()
    .from(schema.area)
    .where(and(eq(schema.area.id, areaId), eq(schema.area.organizationId, context.org.id)));
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Area not found." });
  }
  await assertLocationAccess(context, row.locationId);
  return row;
}

const AREA_HAS_HISTORY = "A Table of this Area has order history, so the Area cannot be deleted.";

const NAME_TAKEN = "An Area with this name already exists in this Location.";

export const areasRouter = {
  /** Areas of a Location, in display order. Any member with access to the Location may read. */
  list: orgProcedure
    .input(z.object({ locationId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      return context.db
        .select()
        .from(schema.area)
        .where(
          and(
            eq(schema.area.locationId, input.locationId),
            eq(schema.area.organizationId, context.org.id),
          ),
        )
        .orderBy(asc(schema.area.sortOrder), asc(schema.area.name));
    }),

  create: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(
      z.object({
        locationId: z.string().min(1),
        name,
        sortOrder: z.number().int().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      let sortOrder = input.sortOrder;
      if (sortOrder === undefined) {
        const [last] = await context.db
          .select({ value: max(schema.area.sortOrder) })
          .from(schema.area)
          .where(eq(schema.area.locationId, input.locationId));
        sortOrder = (last?.value ?? -1) + 1;
      }
      const [created] = await orConflict(NAME_TAKEN, () =>
        context.db
          .insert(schema.area)
          .values({
            organizationId: context.org.id,
            locationId: input.locationId,
            name: input.name,
            sortOrder,
          })
          .returning(),
      );
      return created!;
    }),

  /** Renames and/or reorders an Area. */
  update: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(
      z.object({
        areaId: z.string().min(1),
        name: name.optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const area = await loadAreaInScope(context, input.areaId);
      const changes = definedFields({ name: input.name, sortOrder: input.sortOrder });
      if (Object.keys(changes).length === 0) {
        throw new ORPCError("BAD_REQUEST", { message: "Nothing to update." });
      }
      const [updated] = await orConflict(NAME_TAKEN, () =>
        context.db.update(schema.area).set(changes).where(eq(schema.area.id, area.id)).returning(),
      );
      return updated!;
    }),

  /**
   * Deletes an Area and its Tables. Refused while a Table of the Area has an open Table session
   * (an open Bill), and for any Table that ever had one: Table sessions keep their Table
   * (`no action`), so order and Bill history never disappears.
   */
  delete: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(z.object({ areaId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const area = await loadAreaInScope(context, input.areaId);
      if (await hasOpenBillsInArea(context.db, area.id)) {
        throw new ORPCError("CONFLICT", {
          message: "This Area has Tables with open Bills. Settle them before deleting it.",
        });
      }
      await orRestricted(AREA_HAS_HISTORY, () =>
        context.db.delete(schema.area).where(eq(schema.area.id, area.id)),
      );
      return { deleted: true };
    }),
};
