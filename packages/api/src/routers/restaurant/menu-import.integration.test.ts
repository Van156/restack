import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness, RestaurantSeed } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "menu csv import");

const HEADER = "category,name,price,tax_class,cost,station\n";

describe.skipIf(!reachable)("menu CSV import", () => {
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

  async function counts() {
    return {
      categories: (await harness.db.select().from(schema.menuCategory)).length,
      items: (await harness.db.select().from(schema.menuItem)).length,
      routings: (await harness.db.select().from(schema.stationRouting)).length,
    };
  }

  test("csvTemplate returns the documented columns and an example row", async () => {
    const template = await call(restaurantRouter.menu.csvTemplate, undefined, {
      context: await as("admin"),
    });
    expect(template.columns).toEqual(["category", "name", "price", "tax_class", "cost", "station"]);
    expect(template.csv.split("\n")[0]).toBe("category,name,price,tax_class,cost,station");
    expect(template.csv.split("\n").length).toBeGreaterThan(2);
  });

  test("a dry run validates without writing", async () => {
    const result = await call(
      restaurantRouter.menu.importCsv,
      { csv: `${HEADER}Platos,Sopa,9000,,,\n`, commit: false },
      { context: await as("owner") },
    );
    expect(result).toMatchObject({ valid: true, committed: false, rowCount: 1, errors: [] });
    expect(await counts()).toEqual({ categories: 0, items: 0, routings: 0 });
  });

  test("any error lists every problem and writes nothing, even with commit", async () => {
    const result = await call(
      restaurantRouter.menu.importCsv,
      {
        csv: `${HEADER}Platos,Sopa,9000,,,\nPlatos,,100,,,\nBebidas,Té,abc,,,\n`,
        commit: true,
      },
      { context: await as("owner") },
    );
    expect(result.valid).toBe(false);
    expect(result.committed).toBe(false);
    expect(result.errors.map((e) => [e.line, e.column])).toEqual([
      [3, "name"],
      [4, "price"],
    ]);
    expect(await counts()).toEqual({ categories: 0, items: 0, routings: 0 });
    expect(harness.auditLogger.eventsFor("menu.imported")).toHaveLength(0);
  });

  test("commit writes categories, items, routings in one go and records the audit event", async () => {
    const owner = await as("owner");
    const kitchen = await call(
      restaurantRouter.stations.create,
      { locationId: seed.locations.a, name: "Cocina" },
      { context: owner },
    );
    const existing = await call(
      restaurantRouter.menu.categories.create,
      { name: "Platos" },
      { context: owner },
    );
    const result = await call(
      restaurantRouter.menu.importCsv,
      {
        locationId: seed.locations.a,
        commit: true,
        csv: `${HEADER}Platos,Bandeja paisa,32000,impoconsumo,12000,Cocina\nplatos,Sopa,9000,,,\nBebidas,Limonada,6000,iva19,2000,\n`,
      },
      { context: owner },
    );
    expect(result).toMatchObject({ valid: true, committed: true, rowCount: 3 });
    expect(result.created).toEqual({ categories: 1, items: 3, routings: 1 });
    expect(await counts()).toEqual({ categories: 2, items: 3, routings: 1 });

    const items = await call(restaurantRouter.menu.items.list, undefined, { context: owner });
    const bandeja = items.find((item) => item.name === "Bandeja paisa")!;
    expect(bandeja.categoryId).toBe(existing.id);
    expect([bandeja.price, bandeja.cost]).toEqual([32_000, 12_000]);
    expect(items.find((item) => item.name === "Limonada")!.taxClass).toBe("iva19");

    const menu = await call(
      restaurantRouter.menu.list,
      { locationId: seed.locations.a },
      { context: owner },
    );
    const platos = menu.find((category) => category.name === "Platos")!;
    expect(platos.items.find((item) => item.name === "Bandeja paisa")!.station?.id).toBe(
      kitchen.id,
    );

    const [event] = harness.auditLogger.eventsFor("menu.imported");
    expect(event).toMatchObject({
      organizationId: seed.organizationId,
      actorUserId: seed.staff.owner.userId,
      action: "menu.imported",
      targetType: "organization",
      targetId: seed.organizationId,
      metadata: { items: 3, categories: 1, routings: 1, locationId: seed.locations.a },
    });
  });

  test("re-importing the same file reports every item as already existing", async () => {
    const owner = await as("owner");
    const csv = `${HEADER}Platos,Sopa,9000,,,\n`;
    await call(restaurantRouter.menu.importCsv, { csv, commit: true }, { context: owner });
    const again = await call(
      restaurantRouter.menu.importCsv,
      { csv, commit: true },
      { context: owner },
    );
    expect(again.valid).toBe(false);
    expect(again.errors[0]).toMatchObject({ line: 2, column: "name" });
    expect(await counts()).toMatchObject({ items: 1 });
  });

  test("a station column needs a Location the caller can access", async () => {
    const csv = `${HEADER}Platos,Sopa,9000,,,Cocina\n`;
    const noLocation = await call(
      restaurantRouter.menu.importCsv,
      { csv, commit: true },
      { context: await as("admin") },
    );
    expect(noLocation.errors[0]).toMatchObject({ column: "station" });
    expect(
      await codeOf(
        call(
          restaurantRouter.menu.importCsv,
          { csv, commit: true, locationId: seed.locations.b },
          { context: await as("admin") },
        ),
      ),
    ).toBe("FORBIDDEN");
  });

  test("Waiters and Cashiers cannot import or fetch the template", async () => {
    for (const key of ["waiterA", "cashierA"] as const) {
      expect(
        await codeOf(
          call(
            restaurantRouter.menu.importCsv,
            { csv: HEADER, commit: false },
            { context: await as(key) },
          ),
        ),
      ).toBe("FORBIDDEN");
      expect(
        await codeOf(
          call(restaurantRouter.menu.csvTemplate, undefined, { context: await as(key) }),
        ),
      ).toBe("FORBIDDEN");
    }
  });

  test("import is scoped to the caller's organization", async () => {
    await harness.db
      .insert(schema.menuCategory)
      .values({ organizationId: seed.otherOrganizationId, name: "Platos" });
    const result = await call(
      restaurantRouter.menu.importCsv,
      { csv: `${HEADER}Platos,Sopa,9000,,,\n`, commit: true },
      { context: await as("owner") },
    );
    expect(result.committed).toBe(true);
    const mine = await harness.db.select().from(schema.menuCategory);
    expect(mine.filter((row) => row.organizationId === seed.organizationId)).toHaveLength(1);
  });
});
