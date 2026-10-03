import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type {
  RestaurantHarness,
  RestaurantSeed,
  RestaurantStaffKey,
} from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "restaurant plans");

const DAY_MS = 24 * 60 * 60 * 1000;

describe.skipIf(!reachable)("restaurant plans and trial", () => {
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

  const as = (key: RestaurantStaffKey) =>
    harness.contextFor(seed.staff[key].userId, seed.organizationId);

  const codeOf = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (error) {
      return error instanceof ORPCError ? error.code : "NOT_AN_ORPC_ERROR";
    }
    return undefined;
  };

  const list = async (key: RestaurantStaffKey = "owner") =>
    call(restaurantRouter.plan.list, {}, { context: await as(key) });

  test("the Owner reads the Plan and trial of every Location", async () => {
    const trialEndsAt = new Date(harness.clock.now().getTime() + 10 * DAY_MS);
    await harness.db
      .update(schema.location)
      .set({ plan: "esencial", trialEndsAt })
      .where(eq(schema.location.id, seed.locations.a));

    const rows = await list();
    expect(rows.map((row) => row.locationId).sort()).toEqual(
      [seed.locations.a, seed.locations.b].sort(),
    );
    const a = rows.find((row) => row.locationId === seed.locations.a)!;
    expect(a).toMatchObject({
      plan: "esencial",
      trial: { status: "active", daysRemaining: 10 },
      dianAllowed: true,
    });
    expect(a.trial.endsAt).toEqual(trialEndsAt);
  });

  test("an expired trial on Esencial no longer allows DIAN, and the state follows the clock", async () => {
    await harness.db
      .update(schema.location)
      .set({ plan: "esencial", trialEndsAt: new Date(harness.clock.now().getTime() + DAY_MS) })
      .where(eq(schema.location.id, seed.locations.a));
    expect((await list()).find((row) => row.locationId === seed.locations.a)?.dianAllowed).toBe(
      true,
    );

    harness.clock.setNow(new Date(harness.clock.now().getTime() + 2 * DAY_MS));
    const a = (await list()).find((row) => row.locationId === seed.locations.a)!;
    expect(a.trial.status).toBe("expired");
    expect(a.dianAllowed).toBe(false);
  });

  test("only the Owner reads or sets the Plan", async () => {
    for (const key of ["admin", "cashierA", "waiterA"] as const) {
      expect(await codeOf(list(key))).toBe("FORBIDDEN");
      expect(
        await codeOf(
          call(
            restaurantRouter.plan.set,
            { locationId: seed.locations.a, plan: "esencial" },
            { context: await as(key) },
          ),
        ),
      ).toBe("FORBIDDEN");
    }
  });

  test("set changes the Plan and audits plan.changed with the previous value", async () => {
    const updated = await call(
      restaurantRouter.plan.set,
      { locationId: seed.locations.a, plan: "esencial" },
      { context: await as("owner") },
    );
    expect(updated.plan).toBe("esencial");

    const [row] = await harness.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, "plan.changed"));
    expect(row).toMatchObject({
      organizationId: seed.organizationId,
      actorUserId: seed.staff.owner.userId,
      targetType: "location",
      targetId: seed.locations.a,
      metadata: { previous: "completo", plan: "esencial" },
    });
  });

  test("setting the same Plan again changes and audits nothing", async () => {
    await call(
      restaurantRouter.plan.set,
      { locationId: seed.locations.a, plan: "completo" },
      { context: await as("owner") },
    );
    expect(await harness.db.select().from(schema.auditLog)).toHaveLength(0);
  });

  test("set refuses a Location of another organization", async () => {
    expect(
      await codeOf(
        call(
          restaurantRouter.plan.set,
          { locationId: seed.locations.other, plan: "esencial" },
          { context: await as("owner") },
        ),
      ),
    ).toBe("NOT_FOUND");
  });

  test("each Location has its own Plan", async () => {
    await call(
      restaurantRouter.plan.set,
      { locationId: seed.locations.a, plan: "esencial" },
      { context: await as("owner") },
    );
    const rows = await list();
    expect(rows.find((row) => row.locationId === seed.locations.b)?.plan).toBe("completo");
  });

  describe("document counts", () => {
    const seedCount = (locationId: string, month: string, count: number) =>
      harness.db
        .insert(schema.dianDocumentCounter)
        .values({ organizationId: seed.organizationId, locationId, month, count });

    test("lists the monthly count per Location and flags fair-use breaches without stopping", async () => {
      await seedCount(seed.locations.a, "2026-10", 5_001);
      await seedCount(seed.locations.b, "2026-10", 12);
      await seedCount(seed.locations.a, "2026-09", 40);

      const rows = await call(
        restaurantRouter.plan.documentCounts,
        { month: "2026-10" },
        { context: await as("owner") },
      );
      expect(rows).toEqual([
        { locationId: seed.locations.a, month: "2026-10", count: 5_001, overFairUse: true },
        { locationId: seed.locations.b, month: "2026-10", count: 12, overFairUse: false },
      ]);
    });

    test("defaults to the current Bogota month, reports zero without a counter and filters by Location", async () => {
      await seedCount(seed.locations.a, "2026-10", 7);
      const rows = await call(
        restaurantRouter.plan.documentCounts,
        { locationId: seed.locations.b },
        { context: await as("owner") },
      );
      expect(rows).toEqual([
        { locationId: seed.locations.b, month: "2026-10", count: 0, overFairUse: false },
      ]);
    });

    test("is Owner only and rejects a malformed month", async () => {
      expect(
        await codeOf(
          call(restaurantRouter.plan.documentCounts, {}, { context: await as("admin") }),
        ),
      ).toBe("FORBIDDEN");
      expect(
        await codeOf(
          call(
            restaurantRouter.plan.documentCounts,
            { month: "October" },
            { context: await as("owner") },
          ),
        ),
      ).toBe("BAD_REQUEST");
    });
  });
});
