import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { createRestaurantHarness } from "../testing/restaurant-fixtures";
import type { RestaurantHarness, RestaurantSeed } from "../testing/restaurant-fixtures";
import { accessibleLocationIds, assertLocationAccess } from "./location-scope";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "location scope");

describe.skipIf(!reachable)("location scope", () => {
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

  function scopeOf(key: keyof RestaurantSeed["staff"]) {
    const staff = seed.staff[key];
    const roles = { owner: "owner", admin: "admin", cashierA: "cashier" } as Record<string, string>;
    return {
      db: harness.db,
      org: { id: seed.organizationId },
      member: { id: staff.memberId, role: roles[key] ?? "waiter" },
    };
  }

  async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
    try {
      await promise;
    } catch (error) {
      return error instanceof ORPCError ? error.code : "NOT_AN_ORPC_ERROR";
    }
    return undefined;
  }

  test("the Owner reaches every Location of the organization without assignments", async () => {
    const owner = scopeOf("owner");
    expect((await assertLocationAccess(owner, seed.locations.a)).id).toBe(seed.locations.a);
    expect((await assertLocationAccess(owner, seed.locations.b)).id).toBe(seed.locations.b);
    expect((await accessibleLocationIds(owner)).sort()).toEqual(
      [seed.locations.a, seed.locations.b].sort(),
    );
  });

  test("every non-Owner Role reaches an assigned Location", async () => {
    for (const key of ["admin", "cashierA", "waiterA"] as const) {
      const scope = scopeOf(key);
      expect((await assertLocationAccess(scope, seed.locations.a)).id).toBe(seed.locations.a);
      expect(await accessibleLocationIds(scope)).toEqual([seed.locations.a]);
    }
  });

  test("every non-Owner Role is denied an unassigned Location", async () => {
    for (const key of ["admin", "cashierA", "waiterA"] as const) {
      expect(await codeOf(assertLocationAccess(scopeOf(key), seed.locations.b))).toBe("FORBIDDEN");
    }
    expect(await codeOf(assertLocationAccess(scopeOf("waiterB"), seed.locations.a))).toBe(
      "FORBIDDEN",
    );
  });

  test("a Location of another organization is denied and indistinguishable from a missing one", async () => {
    for (const key of ["owner", "admin", "waiterA"] as const) {
      const scope = scopeOf(key);
      const foreign = await codeOf(assertLocationAccess(scope, seed.locations.other));
      const missing = await codeOf(assertLocationAccess(scope, "does-not-exist"));
      expect(foreign).toBeDefined();
      expect(foreign).toBe(missing);
    }
  });

  test("an assignment never grants access to a Location of another organization", async () => {
    await harness.db.insert(schema.staffLocationAssignment).values({
      organizationId: seed.organizationId,
      memberId: seed.staff.waiterA.memberId,
      locationId: seed.locations.other,
    });
    const scope = scopeOf("waiterA");
    expect(await codeOf(assertLocationAccess(scope, seed.locations.other))).toBe("FORBIDDEN");
    expect(await accessibleLocationIds(scope)).toEqual([seed.locations.a]);
  });
});
