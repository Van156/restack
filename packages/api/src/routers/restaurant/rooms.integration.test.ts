import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness, RestaurantSeed } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "restaurant rooms");

describe.skipIf(!reachable)("restaurant rooms: areas, tables and stations", () => {
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

  const as = (key: keyof RestaurantSeed["staff"]) =>
    harness.contextFor(seed.staff[key].userId, seed.organizationId);

  async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
    try {
      await promise;
    } catch (error) {
      return error instanceof ORPCError ? error.code : "NOT_AN_ORPC_ERROR";
    }
    return undefined;
  }

  async function createArea(key: keyof RestaurantSeed["staff"], locationId: string, name: string) {
    return call(restaurantRouter.areas.create, { locationId, name }, { context: await as(key) });
  }

  async function createTable(
    key: keyof RestaurantSeed["staff"],
    areaId: string,
    name: string,
    seats = 4,
  ) {
    return call(
      restaurantRouter.tables.create,
      { areaId, name, seats },
      { context: await as(key) },
    );
  }

  describe("areas", () => {
    test("an Administrator creates, lists, renames and reorders Areas in their Location", async () => {
      const salon = await createArea("admin", seed.locations.a, "Salón");
      const terraza = await createArea("admin", seed.locations.a, "Terraza");
      expect(salon.sortOrder).toBeLessThan(terraza.sortOrder);

      await call(
        restaurantRouter.areas.update,
        { areaId: terraza.id, name: "Terraza exterior", sortOrder: -1 },
        { context: await as("admin") },
      );
      const listed = await call(
        restaurantRouter.areas.list,
        { locationId: seed.locations.a },
        { context: await as("waiterA") },
      );
      expect(listed.map((row) => row.name)).toEqual(["Terraza exterior", "Salón"]);
    });

    test("an Administrator is denied in a Location they are not assigned to", async () => {
      expect(await codeOf(createArea("admin", seed.locations.b, "Salón"))).toBe("FORBIDDEN");
      const inB = await createArea("owner", seed.locations.b, "Salón B");
      expect(
        await codeOf(
          call(
            restaurantRouter.areas.update,
            { areaId: inB.id, name: "x" },
            { context: await as("admin") },
          ),
        ),
      ).toBe("FORBIDDEN");
      expect(
        await codeOf(
          call(restaurantRouter.areas.delete, { areaId: inB.id }, { context: await as("admin") }),
        ),
      ).toBe("FORBIDDEN");
      expect(
        await codeOf(
          call(
            restaurantRouter.areas.list,
            { locationId: seed.locations.b },
            { context: await as("admin") },
          ),
        ),
      ).toBe("FORBIDDEN");
    });

    test("a Waiter and a Cashier cannot edit Areas", async () => {
      expect(await codeOf(createArea("waiterA", seed.locations.a, "Salón"))).toBe("FORBIDDEN");
      expect(await codeOf(createArea("cashierA", seed.locations.a, "Salón"))).toBe("FORBIDDEN");
    });

    test("names are unique per Location but may repeat across Locations", async () => {
      await createArea("owner", seed.locations.a, "Salón");
      expect(await codeOf(createArea("owner", seed.locations.a, "Salón"))).toBe("CONFLICT");
      await createArea("owner", seed.locations.b, "Salón");
    });

    test("deleting an Area removes it and its Tables", async () => {
      const area = await createArea("owner", seed.locations.a, "Salón");
      await createTable("owner", area.id, "Mesa 1");
      await call(
        restaurantRouter.areas.delete,
        { areaId: area.id },
        { context: await as("owner") },
      );
      expect(await harness.db.select().from(schema.area)).toHaveLength(0);
      expect(await harness.db.select().from(schema.diningTable)).toHaveLength(0);
    });

    test("an Area of another organization is not found, never leaked", async () => {
      const [foreign] = await harness.db
        .insert(schema.area)
        .values({
          organizationId: seed.otherOrganizationId,
          locationId: seed.locations.other,
          name: "Foreign",
        })
        .returning();
      expect(
        await codeOf(
          call(
            restaurantRouter.areas.update,
            { areaId: foreign!.id, name: "x" },
            { context: await as("owner") },
          ),
        ),
      ).toBe("NOT_FOUND");
      expect(await codeOf(createArea("owner", seed.locations.other, "x"))).toBe("NOT_FOUND");
    });
  });

  describe("tables", () => {
    test("creates and lists Tables with their Area, filtered by Area", async () => {
      const salon = await createArea("admin", seed.locations.a, "Salón");
      const terraza = await createArea("admin", seed.locations.a, "Terraza");
      await createTable("admin", salon.id, "Mesa 1", 4);
      await createTable("admin", terraza.id, "Mesa 2", 2);

      const all = await call(
        restaurantRouter.tables.list,
        { locationId: seed.locations.a },
        { context: await as("waiterA") },
      );
      expect(all.map((row) => [row.name, row.areaName, row.seats])).toEqual([
        ["Mesa 1", "Salón", 4],
        ["Mesa 2", "Terraza", 2],
      ]);
      const filtered = await call(
        restaurantRouter.tables.list,
        { locationId: seed.locations.a, areaId: terraza.id },
        { context: await as("waiterA") },
      );
      expect(filtered.map((row) => row.name)).toEqual(["Mesa 2"]);
    });

    test("edits are denied for Waiters and for an Administrator outside their Location", async () => {
      const inA = await createArea("owner", seed.locations.a, "Salón");
      const inB = await createArea("owner", seed.locations.b, "Salón");
      expect(await codeOf(createTable("waiterA", inA.id, "Mesa 1"))).toBe("FORBIDDEN");
      expect(await codeOf(createTable("admin", inB.id, "Mesa 1"))).toBe("FORBIDDEN");
    });

    test("bulk add creates N Tables from a name pattern", async () => {
      const salon = await createArea("owner", seed.locations.a, "Salón");
      const created = await call(
        restaurantRouter.tables.bulkCreate,
        { areaId: salon.id, pattern: "Mesa {n}", start: 5, count: 3, seats: 4 },
        { context: await as("owner") },
      );
      expect(created.map((row) => row.name)).toEqual(["Mesa 5", "Mesa 6", "Mesa 7"]);
      expect(await harness.db.select().from(schema.diningTable)).toHaveLength(3);
    });

    test("bulk add is atomic: one name conflict creates nothing", async () => {
      const salon = await createArea("owner", seed.locations.a, "Salón");
      await createTable("owner", salon.id, "Mesa 3");
      const code = await codeOf(
        call(
          restaurantRouter.tables.bulkCreate,
          { areaId: salon.id, pattern: "Mesa {n}", start: 1, count: 5, seats: 4 },
          { context: await as("owner") },
        ),
      );
      expect(code).toBe("CONFLICT");
      expect(await harness.db.select().from(schema.diningTable)).toHaveLength(1);
    });

    test("bulk add rejects a pattern without {n} and an excessive count", async () => {
      const salon = await createArea("owner", seed.locations.a, "Salón");
      const run = async (input: { pattern: string; count: number }) =>
        codeOf(
          call(
            restaurantRouter.tables.bulkCreate,
            { areaId: salon.id, start: 1, seats: 4, ...input },
            { context: await as("owner") },
          ),
        );
      expect(await run({ pattern: "Mesa", count: 2 })).toBe("BAD_REQUEST");
      expect(await run({ pattern: "Mesa {n}", count: 1000 })).toBe("BAD_REQUEST");
    });

    test("update renames, resizes and moves a Table within its Location only", async () => {
      const salon = await createArea("owner", seed.locations.a, "Salón");
      const terraza = await createArea("owner", seed.locations.a, "Terraza");
      const areaInB = await createArea("owner", seed.locations.b, "Salón");
      const mesa = await createTable("owner", salon.id, "Mesa 1");

      const updated = await call(
        restaurantRouter.tables.update,
        { tableId: mesa.id, name: "Mesa VIP", seats: 8, areaId: terraza.id },
        { context: await as("admin") },
      );
      expect([updated.name, updated.seats, updated.areaId]).toEqual(["Mesa VIP", 8, terraza.id]);
      expect(
        await codeOf(
          call(
            restaurantRouter.tables.update,
            { tableId: mesa.id, areaId: areaInB.id },
            { context: await as("owner") },
          ),
        ),
      ).toBe("BAD_REQUEST");
    });

    test("delete removes a Table", async () => {
      const salon = await createArea("owner", seed.locations.a, "Salón");
      const mesa = await createTable("owner", salon.id, "Mesa 1");
      await call(
        restaurantRouter.tables.delete,
        { tableId: mesa.id },
        { context: await as("admin") },
      );
      expect(await harness.db.select().from(schema.diningTable)).toHaveLength(0);
    });
  });

  describe("stations", () => {
    async function createStation(
      key: keyof RestaurantSeed["staff"],
      locationId: string,
      name: string,
      output?: "kitchen_display" | "printer",
    ) {
      return call(
        restaurantRouter.stations.create,
        { locationId, name, output },
        { context: await as(key) },
      );
    }

    test("creates Stations with kitchen display output and lists them", async () => {
      const cocina = await createStation("admin", seed.locations.a, "Cocina caliente");
      expect(cocina.output).toBe("kitchen_display");
      const listed = await call(
        restaurantRouter.stations.list,
        { locationId: seed.locations.a },
        { context: await as("cashierA") },
      );
      expect(listed.map((row) => [row.name, row.routedItemCount])).toEqual([
        ["Cocina caliente", 0],
      ]);
    });

    test("the printer output is reserved: rejected on create and update", async () => {
      expect(await codeOf(createStation("owner", seed.locations.a, "Barra", "printer"))).toBe(
        "BAD_REQUEST",
      );
      const barra = await createStation("owner", seed.locations.a, "Barra");
      expect(
        await codeOf(
          call(
            restaurantRouter.stations.update,
            { stationId: barra.id, output: "printer" },
            { context: await as("owner") },
          ),
        ),
      ).toBe("BAD_REQUEST");
    });

    test("scope and permission: Waiters denied, Administrator denied outside their Location", async () => {
      expect(await codeOf(createStation("waiterA", seed.locations.a, "Barra"))).toBe("FORBIDDEN");
      expect(await codeOf(createStation("admin", seed.locations.b, "Barra"))).toBe("FORBIDDEN");
    });

    test("rename and delete work when no Menu item is routed", async () => {
      const barra = await createStation("admin", seed.locations.a, "Barra");
      const renamed = await call(
        restaurantRouter.stations.update,
        { stationId: barra.id, name: "Bar" },
        { context: await as("admin") },
      );
      expect(renamed.name).toBe("Bar");
      await call(
        restaurantRouter.stations.delete,
        { stationId: barra.id },
        { context: await as("admin") },
      );
      expect(await harness.db.select().from(schema.station)).toHaveLength(0);
    });

    test("delete is blocked with CONFLICT while Menu items are routed to the Station", async () => {
      const barra = await createStation("owner", seed.locations.a, "Barra");
      const [category] = await harness.db
        .insert(schema.menuCategory)
        .values({ organizationId: seed.organizationId, name: "Bebidas" })
        .returning();
      const [item] = await harness.db
        .insert(schema.menuItem)
        .values({
          organizationId: seed.organizationId,
          categoryId: category!.id,
          name: "Cerveza",
          price: 8_000,
        })
        .returning();
      await harness.db.insert(schema.stationRouting).values({
        organizationId: seed.organizationId,
        locationId: seed.locations.a,
        menuItemId: item!.id,
        stationId: barra.id,
      });

      let message = "";
      try {
        await call(
          restaurantRouter.stations.delete,
          { stationId: barra.id },
          { context: await as("owner") },
        );
      } catch (error) {
        if (error instanceof ORPCError) {
          expect(error.code).toBe("CONFLICT");
          message = error.message;
        }
      }
      expect(message).toContain("routed");
      expect(
        await harness.db.select().from(schema.station).where(eq(schema.station.id, barra.id)),
      ).toHaveLength(1);
    });
  });
});
