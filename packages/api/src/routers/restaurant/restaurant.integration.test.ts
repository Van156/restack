import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness, RestaurantSeed } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "restaurant setup");

const DAY_MS = 24 * 60 * 60 * 1000;

describe.skipIf(!reachable)("restaurant locations and staff assignment", () => {
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

  async function assignedLocationIds(memberId: string): Promise<string[]> {
    const rows = await harness.db
      .select()
      .from(schema.staffLocationAssignment)
      .where(eq(schema.staffLocationAssignment.memberId, memberId));
    return rows.map((row) => row.locationId).sort();
  }

  describe("locations.list", () => {
    test("the Owner sees both Locations", async () => {
      const result = await call(restaurantRouter.locations.list, undefined, {
        context: await as("owner"),
      });
      expect(result.map((row) => row.id).sort()).toEqual([seed.locations.a, seed.locations.b]);
    });

    test("an Administrator, Cashier and Waiter see only their assigned Location", async () => {
      for (const key of ["admin", "cashierA", "waiterA"] as const) {
        const result = await call(restaurantRouter.locations.list, undefined, {
          context: await as(key),
        });
        expect(result.map((row) => row.id)).toEqual([seed.locations.a]);
      }
      const waiterB = await call(restaurantRouter.locations.list, undefined, {
        context: await as("waiterB"),
      });
      expect(waiterB.map((row) => row.id)).toEqual([seed.locations.b]);
    });

    test("never lists a Location of another organization", async () => {
      const result = await call(restaurantRouter.locations.list, undefined, {
        context: await as("owner"),
      });
      expect(result.map((row) => row.id)).not.toContain(seed.locations.other);
    });
  });

  describe("locations.create", () => {
    test("the Owner creates a Location in the active organization on a 30-day Completo trial", async () => {
      const fixedNow = new Date("2026-11-15T12:00:00.000Z");
      harness.clock.setNow(fixedNow);

      const created = await call(
        restaurantRouter.locations.create,
        { name: "Sede Norte", address: "Calle 100 #15-20", isFranchise: true },
        { context: await as("owner") },
      );

      expect(created.organizationId).toBe(seed.organizationId);
      expect(created.plan).toBe("completo");
      expect(created.trialEndsAt?.getTime()).toBe(fixedNow.getTime() + 30 * DAY_MS);
      expect(created.isFranchise).toBe(true);
      expect(created.suggestedTipPercent).toBe(10);
      expect(created.active).toBe(true);
      expect(harness.auditLogger.eventsFor("location.created")).toHaveLength(1);
    });

    test("an Administrator cannot create a Location (the Owner adds Locations)", async () => {
      expect(
        await codeOf(
          call(
            restaurantRouter.locations.create,
            { name: "Sede X" },
            { context: await as("admin") },
          ),
        ),
      ).toBe("FORBIDDEN");
    });

    test("a Waiter cannot create a Location", async () => {
      expect(
        await codeOf(
          call(
            restaurantRouter.locations.create,
            { name: "Sede X" },
            { context: await as("waiterA") },
          ),
        ),
      ).toBe("FORBIDDEN");
    });

    test("rejects a suggested tip above the legal 10 percent", async () => {
      expect(
        await codeOf(
          call(
            restaurantRouter.locations.create,
            { name: "Sede X", suggestedTipPercent: 11 },
            { context: await as("owner") },
          ),
        ),
      ).toBe("BAD_REQUEST");
    });
  });

  describe("locations.update", () => {
    test("the Owner updates any Location and the change is audited", async () => {
      const updated = await call(
        restaurantRouter.locations.update,
        { locationId: seed.locations.b, waitersCanCharge: true, suggestedTipPercent: 8 },
        { context: await as("owner") },
      );
      expect(updated.waitersCanCharge).toBe(true);
      expect(updated.suggestedTipPercent).toBe(8);
      expect(harness.auditLogger.eventsFor("location.updated")).toHaveLength(1);
    });

    test("an Administrator updates an assigned Location but not an unassigned one", async () => {
      const own = await call(
        restaurantRouter.locations.update,
        { locationId: seed.locations.a, name: "Sede Centro" },
        { context: await as("admin") },
      );
      expect(own.name).toBe("Sede Centro");
      expect(
        await codeOf(
          call(
            restaurantRouter.locations.update,
            { locationId: seed.locations.b, name: "Hacked" },
            { context: await as("admin") },
          ),
        ),
      ).toBe("FORBIDDEN");
    });

    test("a Waiter cannot update even their own Location", async () => {
      expect(
        await codeOf(
          call(
            restaurantRouter.locations.update,
            { locationId: seed.locations.a, name: "Nope" },
            { context: await as("waiterA") },
          ),
        ),
      ).toBe("FORBIDDEN");
    });

    test("cannot update a Location of another organization", async () => {
      expect(
        await codeOf(
          call(
            restaurantRouter.locations.update,
            { locationId: seed.locations.other, name: "Nope" },
            { context: await as("owner") },
          ),
        ),
      ).toBe("NOT_FOUND");
    });
  });

  describe("staff.assignLocations", () => {
    test("the Owner assigns a Waiter to several Locations and it is audited", async () => {
      await call(
        restaurantRouter.staff.assignLocations,
        {
          memberId: seed.staff.waiterA.memberId,
          locationIds: [seed.locations.a, seed.locations.b],
        },
        { context: await as("owner") },
      );
      expect(await assignedLocationIds(seed.staff.waiterA.memberId)).toEqual([
        seed.locations.a,
        seed.locations.b,
      ]);
      const events = harness.auditLogger.eventsFor("staff.location_assigned");
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        organizationId: seed.organizationId,
        actorUserId: seed.staff.owner.userId,
        targetType: "member",
        targetId: seed.staff.waiterA.memberId,
        metadata: { added: [seed.locations.b], removed: [] },
      });
    });

    test("assignment replaces the previous set and removals are audited", async () => {
      await call(
        restaurantRouter.staff.assignLocations,
        { memberId: seed.staff.waiterA.memberId, locationIds: [seed.locations.b] },
        { context: await as("owner") },
      );
      expect(await assignedLocationIds(seed.staff.waiterA.memberId)).toEqual([seed.locations.b]);
      const [event] = harness.auditLogger.eventsFor("staff.location_assigned");
      expect(event?.metadata).toMatchObject({
        added: [seed.locations.b],
        removed: [seed.locations.a],
      });
    });

    test("an Administrator assigns within their own Locations", async () => {
      await call(
        restaurantRouter.staff.assignLocations,
        { memberId: seed.staff.waiterB.memberId, locationIds: [seed.locations.a] },
        { context: await as("admin") },
      );
      // Waiter B's assignment to Location B is outside the Administrator's scope and is kept.
      expect(await assignedLocationIds(seed.staff.waiterB.memberId)).toEqual([
        seed.locations.a,
        seed.locations.b,
      ]);
    });

    test("an Administrator cannot assign a Location outside their scope", async () => {
      expect(
        await codeOf(
          call(
            restaurantRouter.staff.assignLocations,
            { memberId: seed.staff.waiterA.memberId, locationIds: [seed.locations.b] },
            { context: await as("admin") },
          ),
        ),
      ).toBe("FORBIDDEN");
      expect(await assignedLocationIds(seed.staff.waiterA.memberId)).toEqual([seed.locations.a]);
      expect(harness.auditLogger.eventsFor("staff.location_assigned")).toHaveLength(0);
    });

    test("an Administrator never touches an Owner", async () => {
      expect(
        await codeOf(
          call(
            restaurantRouter.staff.assignLocations,
            { memberId: seed.staff.owner.memberId, locationIds: [seed.locations.a] },
            { context: await as("admin") },
          ),
        ),
      ).toBe("FORBIDDEN");
      expect(await assignedLocationIds(seed.staff.owner.memberId)).toEqual([]);
    });

    test("a Cashier and a Waiter cannot assign Locations", async () => {
      for (const key of ["cashierA", "waiterA"] as const) {
        expect(
          await codeOf(
            call(
              restaurantRouter.staff.assignLocations,
              { memberId: seed.staff.waiterB.memberId, locationIds: [seed.locations.a] },
              { context: await as(key) },
            ),
          ),
        ).toBe("FORBIDDEN");
      }
    });

    test("cannot assign a Location of another organization", async () => {
      expect(
        await codeOf(
          call(
            restaurantRouter.staff.assignLocations,
            { memberId: seed.staff.waiterA.memberId, locationIds: [seed.locations.other] },
            { context: await as("owner") },
          ),
        ),
      ).toBe("FORBIDDEN");
    });

    test("cannot assign a member of another organization", async () => {
      expect(
        await codeOf(
          call(
            restaurantRouter.staff.assignLocations,
            { memberId: "nobody:nobody", locationIds: [seed.locations.a] },
            { context: await as("owner") },
          ),
        ),
      ).toBe("NOT_FOUND");
    });
  });
});
