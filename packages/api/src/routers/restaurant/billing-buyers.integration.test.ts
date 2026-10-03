import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { seedBillingScenario } from "../../testing/billing-fixtures";
import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "restaurant buyers");

describe.skipIf(!reachable)("restaurant billing: buyer directory", () => {
  let harness: RestaurantHarness;
  let scenario: Awaited<ReturnType<typeof seedBillingScenario>>;

  beforeAll(async () => {
    harness = await createRestaurantHarness();
  });
  afterAll(async () => {
    await harness.close();
  });
  beforeEach(async () => {
    scenario = await seedBillingScenario(harness);
  });

  type StaffKey = Parameters<typeof scenario.as>[0];

  const save = async (extra: Record<string, unknown> = {}, key: StaffKey = "cashierA") =>
    call(
      restaurantRouter.billing.saveBuyer,
      {
        locationId: scenario.seed.locations.a,
        documentType: "nit",
        documentNumber: "900123456",
        name: "Distribuciones Andina SAS",
        email: "facturas@andina.co",
        consent: true,
        ...extra,
      },
      { context: await scenario.as(key) },
    );

  const search = async (query: string, key: StaffKey = "cashierA", extra = {}) =>
    call(
      restaurantRouter.billing.searchBuyers,
      { locationId: scenario.seed.locations.a, query, ...extra },
      { context: await scenario.as(key) },
    );

  test("a buyer is saved only with consent, recorded with its time", async () => {
    expect(await scenario.codeOf(save({ consent: false }))).toBe("BAD_REQUEST");
    expect(await scenario.codeOf(save({ consent: undefined }))).toBe("BAD_REQUEST");
    expect(await harness.db.select().from(schema.buyer)).toHaveLength(0);

    const buyer = await save();
    expect(buyer).toMatchObject({
      documentType: "nit",
      documentNumber: "900123456",
      name: "Distribuciones Andina SAS",
      email: "facturas@andina.co",
      consent: true,
      consentAt: harness.clock.now(),
      createdByMemberId: scenario.seed.staff.cashierA.memberId,
    });
  });

  test("saving the same document again updates the buyer instead of duplicating it", async () => {
    const first = await save();
    const second = await save({ name: "Andina SAS", email: undefined });
    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({ name: "Andina SAS", email: null });
    expect(await harness.db.select().from(schema.buyer)).toHaveLength(1);
  });

  test("search finds buyers by document number prefix or by name, ignoring case", async () => {
    await save();
    await save({
      documentType: "cc",
      documentNumber: "52111222",
      name: "Marta Andrade",
      email: undefined,
    });
    await save({
      documentType: "cc",
      documentNumber: "10999888",
      name: "Pedro Gómez",
      email: undefined,
    });

    expect((await search("9001")).map((row) => row.documentNumber)).toEqual(["900123456"]);
    expect((await search("andina")).map((row) => row.name)).toEqual(["Distribuciones Andina SAS"]);
    expect((await search("AND")).map((row) => row.name).sort()).toEqual([
      "Distribuciones Andina SAS",
      "Marta Andrade",
    ]);
    expect(await search("zzz")).toEqual([]);
    expect(await search("and", "cashierA", { limit: 1 })).toHaveLength(1);
  });

  test("the directory belongs to one organization", async () => {
    await harness.db.insert(schema.buyer).values({
      organizationId: scenario.seed.otherOrganizationId,
      documentType: "nit",
      documentNumber: "900123456",
      name: "Ajena SAS",
      consent: true,
      consentAt: harness.clock.now(),
    });
    expect(await search("900")).toEqual([]);
    await save();
    expect(await search("900")).toHaveLength(1);
    const own = await harness.db
      .select()
      .from(schema.buyer)
      .where(eq(schema.buyer.organizationId, scenario.seed.organizationId));
    expect(own).toHaveLength(1);
  });

  test("is limited to the caller's Locations and to Staff who may charge", async () => {
    expect(await scenario.codeOf(search("ab", "waiterB"))).toBe("FORBIDDEN");
    expect(await scenario.codeOf(save({}, "waiterA"))).toBe("FORBIDDEN");
    expect(
      await scenario.codeOf(
        call(
          restaurantRouter.billing.searchBuyers,
          { locationId: scenario.seed.locations.b, query: "ab" },
          { context: await scenario.as("cashierA") },
        ),
      ),
    ).toBe("FORBIDDEN");
    await harness.db
      .update(schema.location)
      .set({ waitersCanCharge: true })
      .where(eq(schema.location.id, scenario.seed.locations.a));
    expect((await save({}, "waiterA")).name).toBe("Distribuciones Andina SAS");
  });
});
