import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness, RestaurantSeed } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "restaurant menu");

type StaffKey = keyof RestaurantSeed["staff"];

describe.skipIf(!reachable)("restaurant menu and setup review", () => {
  let harness: RestaurantHarness;
  let seed: RestaurantSeed;

  beforeAll(async () => {
    harness = await createRestaurantHarness();
  });
  afterAll(async () => {
    await harness.close();
  });
  beforeEach(async () => {
    await harness.reset();
    seed = await harness.seedRestaurant();
  });

  const as = (key: StaffKey) => harness.contextFor(seed.staff[key].userId, seed.organizationId);

  async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
    try {
      await promise;
    } catch (error) {
      return error instanceof ORPCError ? error.code : "NOT_AN_ORPC_ERROR";
    }
    return undefined;
  }

  async function newCategory(name = "Platos") {
    return call(restaurantRouter.menu.categories.create, { name }, { context: await as("owner") });
  }

  async function newItem(
    categoryId: string,
    overrides: Partial<{
      name: string;
      price: number;
      taxClass: "impoconsumo" | "iva19";
      cost: number | null;
      modifierGroups: {
        name: string;
        minSelect: number;
        maxSelect: number;
        modifiers: { name: string; priceDelta: number }[];
      }[];
    }> = {},
  ) {
    return call(
      restaurantRouter.menu.items.create,
      { categoryId, name: "Bandeja paisa", price: 32_000, ...overrides },
      { context: await as("owner") },
    );
  }

  async function newStation(locationId: string, name = "Cocina") {
    return call(
      restaurantRouter.stations.create,
      { locationId, name },
      { context: await as("owner") },
    );
  }

  describe("categories", () => {
    test("the Owner and an Administrator manage Restaurant-wide categories", async () => {
      const salads = await call(
        restaurantRouter.menu.categories.create,
        { name: "Ensaladas" },
        { context: await as("admin") },
      );
      await call(
        restaurantRouter.menu.categories.update,
        { categoryId: salads.id, name: "Entradas", sortOrder: 5 },
        { context: await as("owner") },
      );
      const listed = await call(restaurantRouter.menu.categories.list, undefined, {
        context: await as("waiterA"),
      });
      expect(listed.map((row) => [row.name, row.sortOrder])).toEqual([["Entradas", 5]]);
    });

    test("Waiters and Cashiers cannot edit categories", async () => {
      for (const key of ["waiterA", "cashierA"] as const) {
        expect(
          await codeOf(
            call(
              restaurantRouter.menu.categories.create,
              { name: "X" },
              { context: await as(key) },
            ),
          ),
        ).toBe("FORBIDDEN");
      }
    });

    test("duplicate names conflict; deleting a category with items is blocked", async () => {
      const category = await newCategory("Platos");
      expect(await codeOf(newCategory("Platos"))).toBe("CONFLICT");
      await newItem(category.id);
      expect(
        await codeOf(
          call(
            restaurantRouter.menu.categories.delete,
            { categoryId: category.id },
            { context: await as("owner") },
          ),
        ),
      ).toBe("CONFLICT");
      const empty = await newCategory("Vacía");
      await call(
        restaurantRouter.menu.categories.delete,
        { categoryId: empty.id },
        { context: await as("owner") },
      );
    });
  });

  describe("items", () => {
    test("creates an item with modifier groups and returns derived base and tax", async () => {
      const category = await newCategory();
      const item = await newItem(category.id, {
        price: 25_000,
        cost: 9_000,
        modifierGroups: [
          {
            name: "Término",
            minSelect: 1,
            maxSelect: 1,
            modifiers: [
              { name: "Medio", priceDelta: 0 },
              { name: "Bien cocido", priceDelta: 0 },
            ],
          },
          {
            name: "Extras",
            minSelect: 0,
            maxSelect: 2,
            modifiers: [
              { name: "Queso", priceDelta: 3_000 },
              { name: "Sin arroz", priceDelta: -1_500 },
            ],
          },
        ],
      });
      expect(item.base).toBe(23_148);
      expect(item.tax).toBe(1_852);
      expect(item.taxClass).toBe("impoconsumo");
      expect(item.cost).toBe(9_000);
      expect(item.modifierGroups.map((group) => group.name)).toEqual(["Término", "Extras"]);
      expect(item.modifierGroups[1]!.modifiers.map((mod) => mod.priceDelta)).toEqual([
        3_000, -1_500,
      ]);
    });

    test("the franchise tax class derives IVA 19%", async () => {
      const category = await newCategory();
      const item = await newItem(category.id, { price: 11_900, taxClass: "iva19" });
      expect([item.base, item.tax]).toEqual([10_000, 1_900]);
    });

    test("validates price, cost and modifier selection limits", async () => {
      const category = await newCategory();
      const owner = await as("owner");
      const base = { categoryId: category.id, name: "X", price: 1_000 };
      const run = (extra: Record<string, unknown>) =>
        codeOf(
          call(restaurantRouter.menu.items.create, { ...base, ...extra } as never, {
            context: owner,
          }),
        );
      expect(await run({ price: -1 })).toBe("BAD_REQUEST");
      expect(await run({ price: 10.5 })).toBe("BAD_REQUEST");
      expect(await run({ cost: -5 })).toBe("BAD_REQUEST");
      expect(
        await run({
          modifierGroups: [
            { name: "G", minSelect: 2, maxSelect: 1, modifiers: [{ name: "a", priceDelta: 0 }] },
          ],
        }),
      ).toBe("BAD_REQUEST");
      expect(
        await run({
          modifierGroups: [
            { name: "G", minSelect: 2, maxSelect: 2, modifiers: [{ name: "a", priceDelta: 0 }] },
          ],
        }),
      ).toBe("BAD_REQUEST");
    });

    test("update replaces modifier groups atomically and edits fields", async () => {
      const category = await newCategory();
      const item = await newItem(category.id, {
        modifierGroups: [
          {
            name: "Viejo",
            minSelect: 0,
            maxSelect: 1,
            modifiers: [{ name: "a", priceDelta: 100 }],
          },
        ],
      });
      const updated = await call(
        restaurantRouter.menu.items.update,
        {
          itemId: item.id,
          price: 40_000,
          cost: null,
          active: false,
          modifierGroups: [
            {
              name: "Nuevo",
              minSelect: 0,
              maxSelect: 1,
              modifiers: [{ name: "b", priceDelta: 0 }],
            },
          ],
        },
        { context: await as("admin") },
      );
      expect(updated.price).toBe(40_000);
      expect(updated.cost).toBeNull();
      expect(updated.active).toBe(false);
      expect(updated.modifierGroups.map((group) => group.name)).toEqual(["Nuevo"]);
      expect(await harness.db.select().from(schema.modifierGroup)).toHaveLength(1);
      expect(await harness.db.select().from(schema.modifier)).toHaveLength(1);
    });

    test("an invalid replacement leaves the existing groups untouched", async () => {
      const category = await newCategory();
      const item = await newItem(category.id, {
        modifierGroups: [
          { name: "Viejo", minSelect: 0, maxSelect: 1, modifiers: [{ name: "a", priceDelta: 0 }] },
        ],
      });
      const code = await codeOf(
        call(
          restaurantRouter.menu.items.update,
          {
            itemId: item.id,
            modifierGroups: [
              {
                name: "Roto",
                minSelect: 3,
                maxSelect: 1,
                modifiers: [{ name: "b", priceDelta: 0 }],
              },
            ],
          },
          { context: await as("owner") },
        ),
      );
      expect(code).toBe("BAD_REQUEST");
      const groups = await harness.db.select().from(schema.modifierGroup);
      expect(groups.map((group) => group.name)).toEqual(["Viejo"]);
    });

    test("items.list shows cost and derived tax to editors; Waiters cannot call it", async () => {
      const category = await newCategory();
      await newItem(category.id, { cost: 8_000 });
      const listed = await call(restaurantRouter.menu.items.list, undefined, {
        context: await as("admin"),
      });
      expect(listed).toHaveLength(1);
      expect(listed[0]!.cost).toBe(8_000);
      expect(listed[0]!.base + listed[0]!.tax).toBe(32_000);
      expect(
        await codeOf(
          call(restaurantRouter.menu.items.list, undefined, { context: await as("waiterA") }),
        ),
      ).toBe("FORBIDDEN");
    });

    test("delete removes the item with its groups, routing and availability", async () => {
      const category = await newCategory();
      const station = await newStation(seed.locations.a);
      const item = await newItem(category.id, {
        modifierGroups: [
          { name: "G", minSelect: 0, maxSelect: 1, modifiers: [{ name: "a", priceDelta: 0 }] },
        ],
      });
      await call(
        restaurantRouter.menu.setRouting,
        { locationId: seed.locations.a, menuItemId: item.id, stationId: station.id },
        { context: await as("owner") },
      );
      await call(
        restaurantRouter.menu.items.delete,
        { itemId: item.id },
        { context: await as("owner") },
      );
      expect(await harness.db.select().from(schema.menuItem)).toHaveLength(0);
      expect(await harness.db.select().from(schema.modifierGroup)).toHaveLength(0);
      expect(await harness.db.select().from(schema.stationRouting)).toHaveLength(0);
    });

    test("an item of another organization is not found", async () => {
      const [foreignCategory] = await harness.db
        .insert(schema.menuCategory)
        .values({ organizationId: seed.otherOrganizationId, name: "Foreign" })
        .returning();
      expect(await codeOf(newItem(foreignCategory!.id))).toBe("NOT_FOUND");
      const [foreignItem] = await harness.db
        .insert(schema.menuItem)
        .values({
          organizationId: seed.otherOrganizationId,
          categoryId: foreignCategory!.id,
          name: "Foreign",
          price: 1,
        })
        .returning();
      expect(
        await codeOf(
          call(
            restaurantRouter.menu.items.update,
            { itemId: foreignItem!.id, price: 2 },
            { context: await as("owner") },
          ),
        ),
      ).toBe("NOT_FOUND");
    });
  });

  describe("routing and sold-out per Location", () => {
    test("routes an item to a different Station at each Location", async () => {
      const category = await newCategory();
      const item = await newItem(category.id);
      const kitchenA = await newStation(seed.locations.a, "Cocina");
      const barB = await newStation(seed.locations.b, "Barra");
      const owner = await as("owner");
      await call(
        restaurantRouter.menu.setRouting,
        { locationId: seed.locations.a, menuItemId: item.id, stationId: kitchenA.id },
        { context: owner },
      );
      await call(
        restaurantRouter.menu.setRouting,
        { locationId: seed.locations.b, menuItemId: item.id, stationId: barB.id },
        { context: owner },
      );
      const inA = await call(
        restaurantRouter.menu.list,
        { locationId: seed.locations.a },
        { context: owner },
      );
      const inB = await call(
        restaurantRouter.menu.list,
        { locationId: seed.locations.b },
        { context: owner },
      );
      expect(inA[0]!.items[0]!.station).toEqual({ id: kitchenA.id, name: "Cocina" });
      expect(inB[0]!.items[0]!.station).toEqual({ id: barB.id, name: "Barra" });
    });

    test("re-routing replaces the routing and null removes it", async () => {
      const category = await newCategory();
      const item = await newItem(category.id);
      const first = await newStation(seed.locations.a, "Cocina");
      const second = await newStation(seed.locations.a, "Barra");
      const owner = await as("owner");
      const route = (stationId: string | null) =>
        call(
          restaurantRouter.menu.setRouting,
          { locationId: seed.locations.a, menuItemId: item.id, stationId },
          { context: owner },
        );
      await route(first.id);
      await route(second.id);
      expect(await harness.db.select().from(schema.stationRouting)).toHaveLength(1);
      await route(null);
      expect(await harness.db.select().from(schema.stationRouting)).toHaveLength(0);
    });

    test("a Station of another Location cannot be used; scope and permission are enforced", async () => {
      const category = await newCategory();
      const item = await newItem(category.id);
      const barB = await newStation(seed.locations.b, "Barra");
      const kitchenA = await newStation(seed.locations.a, "Cocina");
      expect(
        await codeOf(
          call(
            restaurantRouter.menu.setRouting,
            { locationId: seed.locations.a, menuItemId: item.id, stationId: barB.id },
            { context: await as("owner") },
          ),
        ),
      ).toBe("BAD_REQUEST");
      expect(
        await codeOf(
          call(
            restaurantRouter.menu.setRouting,
            { locationId: seed.locations.b, menuItemId: item.id, stationId: barB.id },
            { context: await as("admin") },
          ),
        ),
      ).toBe("FORBIDDEN");
      expect(
        await codeOf(
          call(
            restaurantRouter.menu.setRouting,
            { locationId: seed.locations.a, menuItemId: item.id, stationId: kitchenA.id },
            { context: await as("waiterA") },
          ),
        ),
      ).toBe("FORBIDDEN");
    });

    test("sold-out is per Location and allowed to Owner, Administrator and Cashier only", async () => {
      const category = await newCategory();
      const item = await newItem(category.id);
      await call(
        restaurantRouter.menu.setSoldOut,
        { locationId: seed.locations.a, menuItemId: item.id, soldOut: true },
        { context: await as("cashierA") },
      );
      const inA = await call(
        restaurantRouter.menu.list,
        { locationId: seed.locations.a },
        { context: await as("waiterA") },
      );
      const inB = await call(
        restaurantRouter.menu.list,
        { locationId: seed.locations.b },
        { context: await as("waiterB") },
      );
      expect(inA[0]!.items[0]!.soldOut).toBe(true);
      expect(inB[0]!.items[0]!.soldOut).toBe(false);

      await call(
        restaurantRouter.menu.setSoldOut,
        { locationId: seed.locations.a, menuItemId: item.id, soldOut: false },
        { context: await as("admin") },
      );
      const restored = await call(
        restaurantRouter.menu.list,
        { locationId: seed.locations.a },
        { context: await as("waiterA") },
      );
      expect(restored[0]!.items[0]!.soldOut).toBe(false);

      expect(
        await codeOf(
          call(
            restaurantRouter.menu.setSoldOut,
            { locationId: seed.locations.a, menuItemId: item.id, soldOut: true },
            { context: await as("waiterA") },
          ),
        ),
      ).toBe("FORBIDDEN");
      expect(
        await codeOf(
          call(
            restaurantRouter.menu.setSoldOut,
            { locationId: seed.locations.b, menuItemId: item.id, soldOut: true },
            { context: await as("cashierA") },
          ),
        ),
      ).toBe("FORBIDDEN");
    });

    test("menu.list hides cost from non-editors and flags unrouted items", async () => {
      const category = await newCategory();
      await newItem(category.id, { cost: 5_000 });
      const listed = await call(
        restaurantRouter.menu.list,
        { locationId: seed.locations.a },
        { context: await as("waiterA") },
      );
      const item = listed[0]!.items[0]!;
      expect("cost" in item).toBe(false);
      expect(item.station).toBeNull();
      expect(item.routed).toBe(false);
      expect(item.base + item.tax).toBe(item.price);
    });
  });

  describe("setup.review", () => {
    test("warns about unrouted items, empty Areas and idle Stations, with the tip signage reminder", async () => {
      const category = await newCategory();
      const routed = await newItem(category.id, { name: "Routed" });
      await newItem(category.id, { name: "Unrouted" });
      const kitchen = await newStation(seed.locations.a, "Cocina");
      await newStation(seed.locations.a, "Barra");
      await call(
        restaurantRouter.menu.setRouting,
        { locationId: seed.locations.a, menuItemId: routed.id, stationId: kitchen.id },
        { context: await as("owner") },
      );
      const owner = await as("owner");
      const salon = await call(
        restaurantRouter.areas.create,
        { locationId: seed.locations.a, name: "Salón" },
        { context: owner },
      );
      await call(
        restaurantRouter.areas.create,
        { locationId: seed.locations.a, name: "Terraza" },
        { context: owner },
      );
      await call(
        restaurantRouter.tables.create,
        { areaId: salon.id, name: "Mesa 1", seats: 4 },
        { context: owner },
      );

      const review = await call(
        restaurantRouter.setup.review,
        { locationId: seed.locations.a },
        { context: await as("admin") },
      );
      expect(review.unroutedMenuItems.map((row) => row.name)).toEqual(["Unrouted"]);
      expect(review.emptyAreas.map((row) => row.name)).toEqual(["Terraza"]);
      expect(review.idleStations.map((row) => row.name)).toEqual(["Barra"]);
      expect(review.warningCount).toBe(3);
      expect(review.reminders).toEqual(["advertencia_propina"]);
    });

    test("a fully set up Location has no warnings but keeps the reminder", async () => {
      const review = await call(
        restaurantRouter.setup.review,
        { locationId: seed.locations.b },
        { context: await as("owner") },
      );
      expect(review.warningCount).toBe(0);
      expect(review.reminders).toEqual(["advertencia_propina"]);
    });

    test("inactive items are ignored and access is scoped and permissioned", async () => {
      const category = await newCategory();
      const item = await newItem(category.id);
      await call(
        restaurantRouter.menu.items.update,
        { itemId: item.id, active: false },
        { context: await as("owner") },
      );
      const review = await call(
        restaurantRouter.setup.review,
        { locationId: seed.locations.a },
        { context: await as("owner") },
      );
      expect(review.unroutedMenuItems).toEqual([]);
      expect(
        await codeOf(
          call(
            restaurantRouter.setup.review,
            { locationId: seed.locations.b },
            { context: await as("admin") },
          ),
        ),
      ).toBe("FORBIDDEN");
      expect(
        await codeOf(
          call(
            restaurantRouter.setup.review,
            { locationId: seed.locations.a },
            { context: await as("waiterA") },
          ),
        ),
      ).toBe("FORBIDDEN");
    });
  });
});
