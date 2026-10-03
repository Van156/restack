import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { assertLocationAccess } from "../../lib/location-scope";
import { hasOpenSessionAtTable } from "../../lib/table-session";
import { loadAreaInScope } from "./areas";
import { definedFields, orConflict, orRestricted } from "./setup-helpers";

const name = z.string().trim().min(1).max(80);
const seats = z.number().int().min(1).max(100);

/** Upper bound of one bulk add; keeps a typo from creating thousands of Tables. */
export const MAX_BULK_TABLES = 200;

const NAME_TAKEN = "A Table with this name already exists in this Location.";

export const tablesRouter = {
  /** Tables of a Location with their Area, optionally for one Area. */
  list: orgProcedure
    .input(z.object({ locationId: z.string().min(1), areaId: z.string().min(1).optional() }))
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      const rows = await context.db
        .select({
          id: schema.diningTable.id,
          locationId: schema.diningTable.locationId,
          areaId: schema.diningTable.areaId,
          areaName: schema.area.name,
          name: schema.diningTable.name,
          seats: schema.diningTable.seats,
        })
        .from(schema.diningTable)
        .innerJoin(schema.area, eq(schema.area.id, schema.diningTable.areaId))
        .where(
          and(
            eq(schema.diningTable.locationId, input.locationId),
            eq(schema.diningTable.organizationId, context.org.id),
            input.areaId ? eq(schema.diningTable.areaId, input.areaId) : undefined,
          ),
        )
        .orderBy(asc(schema.area.sortOrder), asc(schema.diningTable.name));
      return rows;
    }),

  create: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(z.object({ areaId: z.string().min(1), name, seats }))
    .handler(async ({ context, input }) => {
      const area = await loadAreaInScope(context, input.areaId);
      const [created] = await orConflict(NAME_TAKEN, () =>
        context.db
          .insert(schema.diningTable)
          .values({
            organizationId: context.org.id,
            locationId: area.locationId,
            areaId: area.id,
            name: input.name,
            seats: input.seats,
          })
          .returning(),
      );
      return created!;
    }),

  /**
   * Adds `count` Tables named from a pattern with `{n}` replaced by `start`, `start + 1`, ... All or
   * nothing: any name already used in the Location fails the whole call.
   */
  bulkCreate: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(
      z.object({
        areaId: z.string().min(1),
        pattern: z.string().trim().min(1).max(80),
        start: z.number().int().min(0).max(100_000),
        count: z.number().int().min(1),
        seats,
      }),
    )
    .handler(async ({ context, input }) => {
      if (!input.pattern.includes("{n}")) {
        throw new ORPCError("BAD_REQUEST", { message: 'The name pattern must contain "{n}".' });
      }
      if (input.count > MAX_BULK_TABLES) {
        throw new ORPCError("BAD_REQUEST", {
          message: `You can add at most ${MAX_BULK_TABLES} Tables at once.`,
        });
      }
      const area = await loadAreaInScope(context, input.areaId);
      const names = Array.from({ length: input.count }, (_, index) =>
        input.pattern.replaceAll("{n}", String(input.start + index)),
      );
      if (new Set(names).size !== names.length) {
        throw new ORPCError("BAD_REQUEST", { message: "The pattern produces duplicate names." });
      }
      return context.db.transaction(async (tx) => {
        const taken = await tx
          .select({ name: schema.diningTable.name })
          .from(schema.diningTable)
          .where(
            and(
              eq(schema.diningTable.locationId, area.locationId),
              inArray(schema.diningTable.name, names),
            ),
          );
        if (taken.length > 0) {
          throw new ORPCError("CONFLICT", {
            message: `These Table names already exist in this Location: ${taken
              .map((row) => row.name)
              .join(", ")}.`,
          });
        }
        return orConflict(NAME_TAKEN, () =>
          tx
            .insert(schema.diningTable)
            .values(
              names.map((tableName) => ({
                organizationId: context.org.id,
                locationId: area.locationId,
                areaId: area.id,
                name: tableName,
                seats: input.seats,
              })),
            )
            .returning(),
        );
      });
    }),

  /** Renames, resizes or moves a Table to another Area of the same Location. */
  update: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(
      z.object({
        tableId: z.string().min(1),
        name: name.optional(),
        seats: seats.optional(),
        areaId: z.string().min(1).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const [table] = await context.db
        .select()
        .from(schema.diningTable)
        .where(
          and(
            eq(schema.diningTable.id, input.tableId),
            eq(schema.diningTable.organizationId, context.org.id),
          ),
        );
      if (!table) {
        throw new ORPCError("NOT_FOUND", { message: "Table not found." });
      }
      await assertLocationAccess(context, table.locationId);
      if (input.areaId) {
        const target = await loadAreaInScope(context, input.areaId);
        if (target.locationId !== table.locationId) {
          throw new ORPCError("BAD_REQUEST", {
            message: "A Table can only move to an Area of its own Location.",
          });
        }
      }
      const changes = definedFields({ name: input.name, seats: input.seats, areaId: input.areaId });
      if (Object.keys(changes).length === 0) {
        throw new ORPCError("BAD_REQUEST", { message: "Nothing to update." });
      }
      const [updated] = await orConflict(NAME_TAKEN, () =>
        context.db
          .update(schema.diningTable)
          .set(changes)
          .where(eq(schema.diningTable.id, table.id))
          .returning(),
      );
      return updated!;
    }),

  delete: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(z.object({ tableId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const [table] = await context.db
        .select()
        .from(schema.diningTable)
        .where(
          and(
            eq(schema.diningTable.id, input.tableId),
            eq(schema.diningTable.organizationId, context.org.id),
          ),
        );
      if (!table) {
        throw new ORPCError("NOT_FOUND", { message: "Table not found." });
      }
      await assertLocationAccess(context, table.locationId);
      if (await hasOpenSessionAtTable(context.db, table.id)) {
        throw new ORPCError("CONFLICT", {
          message: "This Table has an open session. Settle it before deleting the Table.",
        });
      }
      await orRestricted("This Table has order history, so it cannot be deleted.", () =>
        context.db.delete(schema.diningTable).where(eq(schema.diningTable.id, table.id)),
      );
      return { deleted: true };
    }),
};
