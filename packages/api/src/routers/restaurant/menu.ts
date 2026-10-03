import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, count, eq, max } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { assertLocationAccess } from "../../lib/location-scope";
import { loadMenuItems } from "./menu-queries";
import { loadStationInScope } from "./stations";
import { definedFields, orConflict } from "./setup-helpers";

/** int4 ceiling guard for COP amounts; far above any real price. */
const MAX_COP = 100_000_000;

const name = z.string().trim().min(1).max(120);
const price = z.number().int().min(0).max(MAX_COP);
const cost = z.number().int().min(0).max(MAX_COP);
const taxClass = z.enum(["impoconsumo", "iva19"]);

const modifierGroupInput = z
  .object({
    name: z.string().trim().min(1).max(80),
    minSelect: z.number().int().min(0).max(50),
    maxSelect: z.number().int().min(1).max(50),
    modifiers: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(80),
          priceDelta: z.number().int().min(-MAX_COP).max(MAX_COP),
        }),
      )
      .min(1)
      .max(50),
  })
  .refine((group) => group.minSelect <= group.maxSelect, {
    message: "minSelect cannot exceed maxSelect.",
  })
  .refine((group) => group.minSelect <= group.modifiers.length, {
    message: "minSelect cannot exceed the number of modifiers.",
  });

type ModifierGroupInput = z.infer<typeof modifierGroupInput>;

const modifierGroups = z.array(modifierGroupInput).max(20);

const CATEGORY_TAKEN = "A category with this name already exists.";
const ITEM_TAKEN = "A Menu item with this name already exists in this category.";

async function loadCategory(context: { db: Database; org: { id: string } }, categoryId: string) {
  const [row] = await context.db
    .select()
    .from(schema.menuCategory)
    .where(
      and(
        eq(schema.menuCategory.id, categoryId),
        eq(schema.menuCategory.organizationId, context.org.id),
      ),
    );
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Category not found." });
  }
  return row;
}

async function loadItem(context: { db: Database; org: { id: string } }, itemId: string) {
  const [row] = await context.db
    .select()
    .from(schema.menuItem)
    .where(and(eq(schema.menuItem.id, itemId), eq(schema.menuItem.organizationId, context.org.id)));
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Menu item not found." });
  }
  return row;
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function insertModifierGroups(
  tx: Tx,
  organizationId: string,
  menuItemId: string,
  groups: ModifierGroupInput[],
) {
  for (const [groupIndex, group] of groups.entries()) {
    const [created] = await tx
      .insert(schema.modifierGroup)
      .values({
        organizationId,
        menuItemId,
        name: group.name,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        sortOrder: groupIndex,
      })
      .returning({ id: schema.modifierGroup.id });
    await tx.insert(schema.modifier).values(
      group.modifiers.map((modifier, modifierIndex) => ({
        organizationId,
        groupId: created!.id,
        name: modifier.name,
        priceDelta: modifier.priceDelta,
        sortOrder: modifierIndex,
      })),
    );
  }
}

const categoriesRouter = {
  /** Restaurant-wide categories, readable by every member. */
  list: orgProcedure.handler(async ({ context }) =>
    context.db
      .select()
      .from(schema.menuCategory)
      .where(eq(schema.menuCategory.organizationId, context.org.id))
      .orderBy(asc(schema.menuCategory.sortOrder), asc(schema.menuCategory.name)),
  ),

  create: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(z.object({ name: name.max(80), sortOrder: z.number().int().optional() }))
    .handler(async ({ context, input }) => {
      let sortOrder = input.sortOrder;
      if (sortOrder === undefined) {
        const [last] = await context.db
          .select({ value: max(schema.menuCategory.sortOrder) })
          .from(schema.menuCategory)
          .where(eq(schema.menuCategory.organizationId, context.org.id));
        sortOrder = (last?.value ?? -1) + 1;
      }
      const [created] = await orConflict(CATEGORY_TAKEN, () =>
        context.db
          .insert(schema.menuCategory)
          .values({ organizationId: context.org.id, name: input.name, sortOrder })
          .returning(),
      );
      return created!;
    }),

  update: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(
      z.object({
        categoryId: z.string().min(1),
        name: name.max(80).optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const category = await loadCategory(context, input.categoryId);
      const changes = definedFields({ name: input.name, sortOrder: input.sortOrder });
      if (Object.keys(changes).length === 0) {
        throw new ORPCError("BAD_REQUEST", { message: "Nothing to update." });
      }
      const [updated] = await orConflict(CATEGORY_TAKEN, () =>
        context.db
          .update(schema.menuCategory)
          .set(changes)
          .where(eq(schema.menuCategory.id, category.id))
          .returning(),
      );
      return updated!;
    }),

  delete: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(z.object({ categoryId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const category = await loadCategory(context, input.categoryId);
      const [used] = await context.db
        .select({ value: count() })
        .from(schema.menuItem)
        .where(eq(schema.menuItem.categoryId, category.id));
      if ((used?.value ?? 0) > 0) {
        throw new ORPCError("CONFLICT", {
          message: "This category still has Menu items. Move or delete them first.",
        });
      }
      await context.db.delete(schema.menuCategory).where(eq(schema.menuCategory.id, category.id));
      return { deleted: true };
    }),
};

const itemsRouter = {
  /** Restaurant-wide items for the setup screens: includes cost and the derived base and tax. */
  list: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .handler(async ({ context }) => loadMenuItems(context.db, context.org.id)),

  create: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(
      z.object({
        categoryId: z.string().min(1),
        name,
        price,
        taxClass: taxClass.optional(),
        cost: cost.nullable().optional(),
        active: z.boolean().optional(),
        modifierGroups: modifierGroups.optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await loadCategory(context, input.categoryId);
      const itemId = await context.db.transaction(async (tx) => {
        const [created] = await orConflict(ITEM_TAKEN, () =>
          tx
            .insert(schema.menuItem)
            .values({
              organizationId: context.org.id,
              categoryId: input.categoryId,
              name: input.name,
              price: input.price,
              taxClass: input.taxClass,
              cost: input.cost,
              active: input.active,
            })
            .returning({ id: schema.menuItem.id }),
        );
        await insertModifierGroups(tx, context.org.id, created!.id, input.modifierGroups ?? []);
        return created!.id;
      });
      const [item] = await loadMenuItems(context.db, context.org.id, [itemId]);
      return item!;
    }),

  /** Edits fields; when `modifierGroups` is sent it replaces all groups and modifiers atomically. */
  update: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(
      z.object({
        itemId: z.string().min(1),
        categoryId: z.string().min(1).optional(),
        name: name.optional(),
        price: price.optional(),
        taxClass: taxClass.optional(),
        cost: cost.nullable().optional(),
        active: z.boolean().optional(),
        modifierGroups: modifierGroups.optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const existing = await loadItem(context, input.itemId);
      if (input.categoryId) {
        await loadCategory(context, input.categoryId);
      }
      const changes = definedFields({
        categoryId: input.categoryId,
        name: input.name,
        price: input.price,
        taxClass: input.taxClass,
        cost: input.cost,
        active: input.active,
      });
      if (Object.keys(changes).length === 0 && input.modifierGroups === undefined) {
        throw new ORPCError("BAD_REQUEST", { message: "Nothing to update." });
      }
      await context.db.transaction(async (tx) => {
        if (Object.keys(changes).length > 0) {
          await orConflict(ITEM_TAKEN, () =>
            tx.update(schema.menuItem).set(changes).where(eq(schema.menuItem.id, existing.id)),
          );
        }
        if (input.modifierGroups !== undefined) {
          await tx
            .delete(schema.modifierGroup)
            .where(eq(schema.modifierGroup.menuItemId, existing.id));
          await insertModifierGroups(tx, context.org.id, existing.id, input.modifierGroups);
        }
      });
      const [item] = await loadMenuItems(context.db, context.org.id, [existing.id]);
      return item!;
    }),

  delete: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(z.object({ itemId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const item = await loadItem(context, input.itemId);
      await context.db.delete(schema.menuItem).where(eq(schema.menuItem.id, item.id));
      return { deleted: true };
    }),
};

export const menuRouter = {
  categories: categoriesRouter,
  items: itemsRouter,

  /**
   * The menu as one Location sees it: categories with items, derived base and tax, sold-out flag
   * and routed Station. Cost is never included. Any member with access to the Location may read.
   */
  list: orgProcedure
    .input(z.object({ locationId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      const [categories, items, availability, routings] = await Promise.all([
        context.db
          .select()
          .from(schema.menuCategory)
          .where(eq(schema.menuCategory.organizationId, context.org.id))
          .orderBy(asc(schema.menuCategory.sortOrder), asc(schema.menuCategory.name)),
        loadMenuItems(context.db, context.org.id),
        context.db
          .select()
          .from(schema.menuItemAvailability)
          .where(eq(schema.menuItemAvailability.locationId, input.locationId)),
        context.db
          .select({
            menuItemId: schema.stationRouting.menuItemId,
            stationId: schema.station.id,
            stationName: schema.station.name,
          })
          .from(schema.stationRouting)
          .innerJoin(schema.station, eq(schema.station.id, schema.stationRouting.stationId))
          .where(eq(schema.stationRouting.locationId, input.locationId)),
      ]);
      const soldOut = new Set(
        availability.filter((row) => row.soldOut).map((row) => row.menuItemId),
      );
      const routing = new Map(routings.map((row) => [row.menuItemId, row]));
      return categories.map((category) => ({
        id: category.id,
        name: category.name,
        sortOrder: category.sortOrder,
        items: items
          .filter((item) => item.categoryId === category.id)
          .map(({ cost: _cost, ...item }) => {
            const route = routing.get(item.id);
            return {
              ...item,
              soldOut: soldOut.has(item.id),
              routed: route !== undefined,
              station: route ? { id: route.stationId, name: route.stationName } : null,
            };
          }),
      }));
    }),

  /** Sets (or with `stationId: null` clears) the Station that prepares an item at a Location. */
  setRouting: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(
      z.object({
        locationId: z.string().min(1),
        menuItemId: z.string().min(1),
        stationId: z.string().min(1).nullable(),
      }),
    )
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      const item = await loadItem(context, input.menuItemId);
      if (input.stationId === null) {
        await context.db
          .delete(schema.stationRouting)
          .where(
            and(
              eq(schema.stationRouting.locationId, input.locationId),
              eq(schema.stationRouting.menuItemId, item.id),
            ),
          );
        return { menuItemId: item.id, stationId: null };
      }
      const station = await loadStationInScope(context, input.stationId);
      if (station.locationId !== input.locationId) {
        throw new ORPCError("BAD_REQUEST", {
          message: "The Station belongs to a different Location.",
        });
      }
      await context.db
        .insert(schema.stationRouting)
        .values({
          organizationId: context.org.id,
          locationId: input.locationId,
          menuItemId: item.id,
          stationId: station.id,
        })
        .onConflictDoUpdate({
          target: [schema.stationRouting.locationId, schema.stationRouting.menuItemId],
          set: { stationId: station.id },
        });
      return { menuItemId: item.id, stationId: station.id };
    }),

  /** Marks or restores an item as sold out at one Location (Owner, Administrator, Cashier). */
  setSoldOut: orgProcedure
    .use(requirePermission({ menu: ["soldOut"] }))
    .input(
      z.object({
        locationId: z.string().min(1),
        menuItemId: z.string().min(1),
        soldOut: z.boolean(),
      }),
    )
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      const item = await loadItem(context, input.menuItemId);
      await context.db
        .insert(schema.menuItemAvailability)
        .values({
          organizationId: context.org.id,
          locationId: input.locationId,
          menuItemId: item.id,
          soldOut: input.soldOut,
        })
        .onConflictDoUpdate({
          target: [schema.menuItemAvailability.locationId, schema.menuItemAvailability.menuItemId],
          set: { soldOut: input.soldOut },
        });
      return { menuItemId: item.id, soldOut: input.soldOut };
    }),
};
