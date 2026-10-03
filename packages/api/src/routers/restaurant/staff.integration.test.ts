import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness, RestaurantSeed } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "restaurant staff");

const MINUTE_MS = 60 * 1000;

describe.skipIf(!reachable)("restaurant staff: assignments, invitations and PINs", () => {
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

  async function setPin(key: keyof RestaurantSeed["staff"], pin: string, currentPin?: string) {
    return call(restaurantRouter.staff.setPin, { pin, currentPin }, { context: await as(key) });
  }

  async function pinRow(key: keyof RestaurantSeed["staff"]) {
    const [row] = await harness.db
      .select()
      .from(schema.staffPin)
      .where(eq(schema.staffPin.memberId, seed.staff[key].memberId));
    return row;
  }

  describe("assignments", () => {
    test("an Administrator assigns, lists and unassigns a Staff member inside their Location", async () => {
      await call(
        restaurantRouter.staff.assign,
        { memberId: seed.staff.waiterB.memberId, locationId: seed.locations.a },
        { context: await as("admin") },
      );
      const listed = await call(
        restaurantRouter.staff.listAssignments,
        { locationId: seed.locations.a },
        { context: await as("admin") },
      );
      const waiterB = listed.find((row) => row.memberId === seed.staff.waiterB.memberId);
      expect(waiterB?.locationIds).toContain(seed.locations.a);
      expect(harness.auditLogger.events.some((e) => e.action === "staff.location_assigned")).toBe(
        true,
      );

      await call(
        restaurantRouter.staff.unassign,
        { memberId: seed.staff.waiterB.memberId, locationId: seed.locations.a },
        { context: await as("admin") },
      );
      const after = await call(
        restaurantRouter.staff.listAssignments,
        { locationId: seed.locations.a },
        { context: await as("admin") },
      );
      expect(after.some((row) => row.memberId === seed.staff.waiterB.memberId)).toBe(false);
    });

    test("an Administrator cannot assign into a Location they do not have", async () => {
      const code = await codeOf(
        call(
          restaurantRouter.staff.assign,
          { memberId: seed.staff.waiterA.memberId, locationId: seed.locations.b },
          { context: await as("admin") },
        ),
      );
      expect(code).toBe("FORBIDDEN");
    });

    test("a Waiter cannot manage assignments", async () => {
      const code = await codeOf(
        call(
          restaurantRouter.staff.assign,
          { memberId: seed.staff.waiterA.memberId, locationId: seed.locations.a },
          { context: await as("waiterA") },
        ),
      );
      expect(code).toBe("FORBIDDEN");
    });

    test("the Owner lists every Staff member of every Location", async () => {
      const listed = await call(
        restaurantRouter.staff.listAssignments,
        {},
        {
          context: await as("owner"),
        },
      );
      expect(
        listed.find((row) => row.memberId === seed.staff.waiterB.memberId)?.locationIds,
      ).toEqual([seed.locations.b]);
    });
  });

  describe("invitations", () => {
    async function seedInvitation() {
      const id = "inv-1";
      await harness.db.insert(schema.invitation).values({
        id,
        organizationId: seed.organizationId,
        email: "new@example.com",
        role: "waiter",
        expiresAt: new Date(harness.clock.now().getTime() + 48 * 60 * MINUTE_MS),
        inviterId: seed.staff.admin.userId,
      });
      return id;
    }

    test("an Administrator attaches Locations to a pending invitation inside their scope", async () => {
      const invitationId = await seedInvitation();
      await call(
        restaurantRouter.staff.setInvitationLocations,
        { invitationId, locationIds: [seed.locations.a] },
        { context: await as("admin") },
      );
      const rows = await harness.db
        .select()
        .from(schema.invitationLocation)
        .where(eq(schema.invitationLocation.invitationId, invitationId));
      expect(rows.map((row) => row.locationId)).toEqual([seed.locations.a]);
    });

    test("an Administrator cannot attach a Location they do not have", async () => {
      const invitationId = await seedInvitation();
      const code = await codeOf(
        call(
          restaurantRouter.staff.setInvitationLocations,
          { invitationId, locationIds: [seed.locations.b] },
          { context: await as("admin") },
        ),
      );
      expect(code).toBe("FORBIDDEN");
    });

    test("an invitation of another organization is not found", async () => {
      await harness.db.insert(schema.invitation).values({
        id: "inv-foreign",
        organizationId: seed.otherOrganizationId,
        email: "x@example.com",
        role: "waiter",
        expiresAt: new Date(harness.clock.now().getTime() + 60 * MINUTE_MS),
        inviterId: seed.staff.admin.userId,
      });
      const code = await codeOf(
        call(
          restaurantRouter.staff.setInvitationLocations,
          { invitationId: "inv-foreign", locationIds: [seed.locations.a] },
          { context: await as("owner") },
        ),
      );
      expect(code).toBe("NOT_FOUND");
    });
  });

  describe("PIN set and change", () => {
    test("a Staff member sets their own PIN, stored hashed", async () => {
      await setPin("waiterA", "4821");
      const row = await pinRow("waiterA");
      expect(row).toBeDefined();
      expect(row!.pinHash).not.toContain("4821");
      expect(row!.failedAttempts).toBe(0);
    });

    test("a PIN must be 4 to 6 digits", async () => {
      expect(await codeOf(setPin("waiterA", "12"))).toBe("BAD_REQUEST");
      expect(await codeOf(setPin("waiterA", "abcd"))).toBe("BAD_REQUEST");
    });

    test("changing an existing PIN requires the current PIN", async () => {
      await setPin("waiterA", "4821");
      expect(await codeOf(setPin("waiterA", "5555"))).toBe("FORBIDDEN");
      expect(await codeOf(setPin("waiterA", "5555", "0000"))).toBe("FORBIDDEN");
      await setPin("waiterA", "5555", "4821");
      await call(
        restaurantRouter.staff.switchIn,
        { locationId: seed.locations.a, memberId: seed.staff.waiterA.memberId, pin: "5555" },
        { context: await as("cashierA") },
      );
    });
  });

  describe("PIN reset", () => {
    test("an Administrator resets the PIN of Staff in their Location, audited, clearing the lockout", async () => {
      await setPin("waiterA", "4821");
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await codeOf(
          call(
            restaurantRouter.staff.switchIn,
            { locationId: seed.locations.a, memberId: seed.staff.waiterA.memberId, pin: "0000" },
            { context: await as("cashierA") },
          ),
        );
      }
      expect((await pinRow("waiterA"))!.lockedUntil).not.toBeNull();

      await call(
        restaurantRouter.staff.resetPin,
        { memberId: seed.staff.waiterA.memberId, pin: "9999" },
        { context: await as("admin") },
      );
      const row = await pinRow("waiterA");
      expect(row!.failedAttempts).toBe(0);
      expect(row!.lockedUntil).toBeNull();
      expect(harness.auditLogger.events.some((e) => e.action === "staff.pin_reset")).toBe(true);
      const result = await call(
        restaurantRouter.staff.switchIn,
        { locationId: seed.locations.a, memberId: seed.staff.waiterA.memberId, pin: "9999" },
        { context: await as("cashierA") },
      );
      expect(result.memberId).toBe(seed.staff.waiterA.memberId);
    });

    test("a Waiter cannot reset a PIN", async () => {
      const code = await codeOf(
        call(
          restaurantRouter.staff.resetPin,
          { memberId: seed.staff.cashierA.memberId, pin: "9999" },
          { context: await as("waiterA") },
        ),
      );
      expect(code).toBe("FORBIDDEN");
    });

    test("an Administrator cannot reset the Owner's PIN nor Staff outside their Locations", async () => {
      expect(
        await codeOf(
          call(
            restaurantRouter.staff.resetPin,
            { memberId: seed.staff.owner.memberId, pin: "9999" },
            { context: await as("admin") },
          ),
        ),
      ).toBe("FORBIDDEN");
      expect(
        await codeOf(
          call(
            restaurantRouter.staff.resetPin,
            { memberId: seed.staff.waiterB.memberId, pin: "9999" },
            { context: await as("admin") },
          ),
        ),
      ).toBe("FORBIDDEN");
    });

    test("the Owner resets anyone's PIN", async () => {
      await call(
        restaurantRouter.staff.resetPin,
        { memberId: seed.staff.waiterB.memberId, pin: "9999" },
        { context: await as("owner") },
      );
      expect(await pinRow("waiterB")).toBeDefined();
    });
  });

  describe("PIN switch-in and lockout", () => {
    test("a correct PIN returns the switched-in identity, Role and Location", async () => {
      await setPin("waiterA", "4821");
      const result = await call(
        restaurantRouter.staff.switchIn,
        { locationId: seed.locations.a, memberId: seed.staff.waiterA.memberId, pin: "4821" },
        { context: await as("cashierA") },
      );
      expect(result).toMatchObject({
        memberId: seed.staff.waiterA.memberId,
        userId: seed.staff.waiterA.userId,
        role: "waiter",
        locationId: seed.locations.a,
      });
    });

    test("five wrong PINs lock the Staff member temporarily, even for the right PIN, until the lockout passes", async () => {
      await setPin("waiterA", "4821");
      const attempt = async (pin: string) =>
        codeOf(
          call(
            restaurantRouter.staff.switchIn,
            { locationId: seed.locations.a, memberId: seed.staff.waiterA.memberId, pin },
            { context: await as("cashierA") },
          ),
        );
      for (let index = 0; index < 5; index += 1) {
        expect(await attempt("0000")).toBe("FORBIDDEN");
      }
      expect(await attempt("4821")).toBe("TOO_MANY_REQUESTS");

      harness.clock.setNow(new Date(harness.clock.now().getTime() + 16 * MINUTE_MS));
      expect(await attempt("4821")).toBeUndefined();
    });

    test("a correct PIN resets the failed attempt counter", async () => {
      await setPin("waiterA", "4821");
      const switchIn = async (pin: string) =>
        codeOf(
          call(
            restaurantRouter.staff.switchIn,
            { locationId: seed.locations.a, memberId: seed.staff.waiterA.memberId, pin },
            { context: await as("cashierA") },
          ),
        );
      await switchIn("0000");
      await switchIn("0000");
      await switchIn("4821");
      expect((await pinRow("waiterA"))!.failedAttempts).toBe(0);
    });

    test("a Staff member without a PIN, or not assigned to the Location, cannot be switched in", async () => {
      expect(
        await codeOf(
          call(
            restaurantRouter.staff.switchIn,
            { locationId: seed.locations.a, memberId: seed.staff.waiterA.memberId, pin: "4821" },
            { context: await as("cashierA") },
          ),
        ),
      ).toBe("FORBIDDEN");
      await setPin("waiterB", "4821");
      expect(
        await codeOf(
          call(
            restaurantRouter.staff.switchIn,
            { locationId: seed.locations.a, memberId: seed.staff.waiterB.memberId, pin: "4821" },
            { context: await as("cashierA") },
          ),
        ),
      ).toBe("FORBIDDEN");
    });

    test("the caller must have access to the Location of the shared device", async () => {
      await setPin("waiterB", "4821");
      expect(
        await codeOf(
          call(
            restaurantRouter.staff.switchIn,
            { locationId: seed.locations.b, memberId: seed.staff.waiterB.memberId, pin: "4821" },
            { context: await as("cashierA") },
          ),
        ),
      ).toBe("FORBIDDEN");
    });
  });
});
