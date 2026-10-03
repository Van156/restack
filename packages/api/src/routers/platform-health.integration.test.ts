import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import type { Context } from "../context";
import { seedService } from "../testing/orders-fixtures";
import type { ServiceSeed } from "../testing/orders-fixtures";
import { createRestaurantHarness } from "../testing/restaurant-fixtures";
import type { RestaurantHarness, RestaurantSeed } from "../testing/restaurant-fixtures";
import { platformRouter } from "./platform";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "platform health");

const DAY_MS = 24 * 60 * 60 * 1000;
const SIGNUP = new Date("2026-10-01T15:00:00.000Z");

/** The Bogota noon of a business day. */
const noon = (date: string) => new Date(`${date}T17:00:00.000Z`);

describe.skipIf(!reachable)("platform product health", () => {
  let harness: RestaurantHarness;
  let seed: RestaurantSeed;
  let service: ServiceSeed;

  beforeAll(async () => {
    harness = await createRestaurantHarness();
  });
  afterAll(async () => {
    await harness.close();
  });
  beforeEach(async () => {
    await harness.reset();
    seed = await harness.seedRestaurant();
    service = await seedService(harness, seed);
    // Rows default to the real time; pin everything outside the windows under test.
    const longAgo = new Date("2026-08-01T00:00:00.000Z");
    await harness.db.update(schema.location).set({ createdAt: longAgo });
    await harness.db.update(schema.diningTable).set({ createdAt: longAgo });
    await harness.db.update(schema.station).set({ createdAt: longAgo });
    await harness.db.update(schema.stationRouting).set({ createdAt: longAgo });
  });

  /** A context holding the platform permission; the real authorization port stays for everything else. */
  async function operator(): Promise<Context> {
    const context = await harness.contextFor(seed.staff.owner.userId, seed.organizationId);
    return {
      ...context,
      authorization: { ...context.authorization, hasPlatformPermission: async () => true },
    };
  }

  const codeOf = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (error) {
      return error instanceof ORPCError ? error.code : "NOT_AN_ORPC_ERROR";
    }
    return undefined;
  };

  const weekly = async (input: { date?: string } = {}) =>
    call(platformRouter.health.weeklyActive, input, { context: await operator() });

  const activated = async (input: { from?: string; to?: string } = {}) =>
    call(platformRouter.health.activated, input, { context: await operator() });

  const closeShift = (locationId: string, closedAt: Date) =>
    harness.db.insert(schema.cashShift).values({
      organizationId:
        locationId === seed.locations.other ? seed.otherOrganizationId : seed.organizationId,
      locationId,
      openedAt: new Date(closedAt.getTime() - 60_000),
      openingAmount: 0,
      closedAt,
    });

  describe("access", () => {
    test("an organization Owner holds no platform permission", async () => {
      const context = await harness.contextFor(seed.staff.owner.userId, seed.organizationId);
      expect(await codeOf(call(platformRouter.health.weeklyActive, {}, { context }))).toBe(
        "FORBIDDEN",
      );
      expect(await codeOf(call(platformRouter.health.activated, {}, { context }))).toBe(
        "FORBIDDEN",
      );
    });

    test("the operator needs the health permission specifically", async () => {
      const context = await harness.contextFor(seed.staff.owner.userId, seed.organizationId);
      const asked: Record<string, string[]>[] = [];
      const probe = {
        ...context,
        authorization: {
          ...context.authorization,
          hasPlatformPermission: async (_userId: string, permissions: Record<string, string[]>) => {
            asked.push(permissions);
            return true;
          },
        },
      };
      await call(platformRouter.health.weeklyActive, {}, { context: probe });
      await call(platformRouter.health.activated, {}, { context: probe });
      expect(asked).toEqual([{ health: ["read"] }, { health: ["read"] }]);
    });
  });

  describe("Weekly Active Locations", () => {
    test("a Location that closed a Cash shift on 5 days of the week is active, 4 days is not", async () => {
      for (const date of ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]) {
        await closeShift(seed.locations.a, noon(date));
      }
      for (const date of ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"]) {
        await closeShift(seed.locations.b, noon(date));
      }

      const report = await weekly({ date: "2026-10-07" });
      expect(report).toMatchObject({
        weekStart: "2026-10-05",
        weekEnd: "2026-10-11",
        activeCount: 1,
      });
      expect(report.locations).toEqual([
        {
          locationId: seed.locations.a,
          organizationId: seed.organizationId,
          name: "Sede A",
          closeDays: 5,
          active: true,
        },
        {
          locationId: seed.locations.b,
          organizationId: seed.organizationId,
          name: "Sede B",
          closeDays: 4,
          active: false,
        },
      ]);
    });

    test("several closes on one day count once, and only closed shifts count", async () => {
      for (const date of ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"]) {
        await closeShift(seed.locations.a, noon(date));
      }
      await closeShift(seed.locations.a, new Date("2026-10-08T23:00:00.000Z"));
      await harness.db.insert(schema.cashShift).values({
        organizationId: seed.organizationId,
        locationId: seed.locations.a,
        openedAt: noon("2026-10-09"),
        openingAmount: 0,
      });

      const report = await weekly({ date: "2026-10-05" });
      expect(report.activeCount).toBe(0);
      expect(report.locations[0]).toMatchObject({ closeDays: 4, active: false });
    });

    test("the week follows Bogota midnight: Sunday 23:30 is this week, Monday 00:30 the next", async () => {
      await closeShift(seed.locations.a, new Date("2026-10-12T04:30:00.000Z"));
      await closeShift(seed.locations.a, new Date("2026-10-12T05:30:00.000Z"));

      const first = await weekly({ date: "2026-10-05" });
      const next = await weekly({ date: "2026-10-12" });
      expect(first.locations[0]).toMatchObject({ closeDays: 1 });
      expect(next.locations[0]).toMatchObject({ closeDays: 1 });
    });

    test("defaults to the week of the injected clock and covers every organization", async () => {
      harness.clock.setNow(noon("2026-10-07"));
      await closeShift(seed.locations.other, noon("2026-10-06"));
      const report = await weekly();
      expect(report.weekStart).toBe("2026-10-05");
      expect(report.locations).toEqual([
        expect.objectContaining({
          locationId: seed.locations.other,
          organizationId: seed.otherOrganizationId,
          closeDays: 1,
        }),
      ]);
    });

    test("rejects a malformed date", async () => {
      expect(await codeOf(weekly({ date: "7/10/2026" }))).toBe("BAD_REQUEST");
    });
  });

  describe("Activated Locations", () => {
    async function settleBills(locationId: string, count: number, settledAt: Date) {
      const tableId = locationId === seed.locations.a ? service.tables.t1 : service.tables.b1;
      for (let index = 0; index < count; index += 1) {
        const [session] = await harness.db
          .insert(schema.tableSession)
          .values({
            organizationId: seed.organizationId,
            locationId,
            tableId,
            status: "settled",
            openedAt: settledAt,
            settledAt,
            shortCode: "ABC123",
          })
          .returning();
        await harness.db.insert(schema.bill).values({
          organizationId: seed.organizationId,
          locationId,
          tableSessionId: session!.id,
          status: "settled",
          total: 1_000,
          settledAt,
        });
      }
    }

    async function signUp(locationId: string, setupAt: Date = SIGNUP) {
      await harness.db
        .update(schema.location)
        .set({ createdAt: SIGNUP })
        .where(eq(schema.location.id, locationId));
      await harness.db
        .update(schema.diningTable)
        .set({ createdAt: setupAt })
        .where(eq(schema.diningTable.locationId, locationId));
      await harness.db
        .update(schema.station)
        .set({ createdAt: setupAt })
        .where(eq(schema.station.locationId, locationId));
      await harness.db
        .update(schema.stationRouting)
        .set({ createdAt: setupAt })
        .where(eq(schema.stationRouting.locationId, locationId));
    }

    const window = { from: "2026-10-01", to: "2026-10-01" };
    const within = new Date(SIGNUP.getTime() + 3 * DAY_MS);
    const find = (report: Awaited<ReturnType<typeof activated>>, locationId: string) =>
      report.locations.find((row) => row.locationId === locationId)!;

    test("setup finished, 20 Bills settled and a Cash shift closed within 7 days activate the Location", async () => {
      await signUp(seed.locations.a);
      await settleBills(seed.locations.a, 20, within);
      await closeShift(seed.locations.a, within);
      harness.clock.setNow(within);

      const report = await activated(window);
      expect(find(report, seed.locations.a)).toMatchObject({
        status: "activated",
        signedUpAt: SIGNUP,
        windowEndsAt: new Date(SIGNUP.getTime() + 7 * DAY_MS),
        criteria: { setupFinished: true, settledBills: 20, shiftClosed: true },
      });
      expect(report).toMatchObject({ activatedCount: 1 });
    });

    test("19 Bills, a missing close or unfinished setup keep it pending, then not activated once the window passed", async () => {
      await signUp(seed.locations.a);
      await settleBills(seed.locations.a, 19, within);
      await closeShift(seed.locations.a, within);
      harness.clock.setNow(within);
      expect(find(await activated(window), seed.locations.a).status).toBe("pending");

      harness.clock.setNow(new Date(SIGNUP.getTime() + 7 * DAY_MS));
      expect(find(await activated(window), seed.locations.a).status).toBe("not_activated");
    });

    test("work after the 7 days does not count", async () => {
      await signUp(seed.locations.a);
      const late = new Date(SIGNUP.getTime() + 8 * DAY_MS);
      await settleBills(seed.locations.a, 20, late);
      await closeShift(seed.locations.a, late);
      harness.clock.setNow(late);

      const row = find(await activated(window), seed.locations.a);
      expect(row).toMatchObject({
        status: "not_activated",
        criteria: { setupFinished: true, settledBills: 0, shiftClosed: false },
      });
    });

    test("setup finished means Tables, a Station and a routed Menu item, all there within the window", async () => {
      await signUp(seed.locations.a, new Date(SIGNUP.getTime() + 9 * DAY_MS));
      expect(find(await activated(window), seed.locations.a).criteria.setupFinished).toBe(false);

      await signUp(seed.locations.a);
      expect(find(await activated(window), seed.locations.a).criteria.setupFinished).toBe(true);

      await harness.db.delete(schema.stationRouting);
      expect(find(await activated(window), seed.locations.a).criteria.setupFinished).toBe(false);
    });

    test("an inactive Menu item does not finish the setup", async () => {
      await signUp(seed.locations.a);
      await harness.db.update(schema.menuItem).set({ active: false });
      expect(find(await activated(window), seed.locations.a).criteria.setupFinished).toBe(false);
    });

    test("the rate is activated over decided Locations; pending ones are left out, the cohort filters by signup day", async () => {
      await signUp(seed.locations.a);
      await settleBills(seed.locations.a, 20, within);
      await closeShift(seed.locations.a, within);
      await signUp(seed.locations.b);
      await harness.db
        .update(schema.location)
        .set({ createdAt: new Date(SIGNUP.getTime() - 20 * DAY_MS) })
        .where(eq(schema.location.id, seed.locations.other));
      harness.clock.setNow(new Date(SIGNUP.getTime() + 10 * DAY_MS));

      const report = await activated(window);
      expect(report).toMatchObject({
        cohortSize: 2,
        activatedCount: 1,
        pendingCount: 0,
        activationRate: 0.5,
      });
      expect(report.locations.map((row) => row.locationId).sort()).toEqual(
        [seed.locations.a, seed.locations.b].sort(),
      );

      harness.clock.setNow(within);
      const early = await activated(window);
      expect(early).toMatchObject({ pendingCount: 1, activatedCount: 1, activationRate: 1 });
    });

    test("an empty cohort has no rate", async () => {
      expect(await activated({ from: "2020-01-01", to: "2020-01-02" })).toMatchObject({
        cohortSize: 0,
        activationRate: null,
        locations: [],
      });
    });

    test("rejects malformed days", async () => {
      expect(await codeOf(activated({ from: "yesterday" }))).toBe("BAD_REQUEST");
    });
  });
});
