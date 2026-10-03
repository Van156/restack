import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { deriveOfflineKey } from "../../lib/offline-actor";
import { seedBillingScenario } from "../../testing/billing-fixtures";
import {
  createRestaurantHarness,
  TEST_ACTING_TOKEN_SECRET,
} from "../../testing/restaurant-fixtures";
import type { RestaurantHarness } from "../../testing/restaurant-fixtures";
import { openOffline, toHex } from "../../testing/offline-client";
import type { OfflineMaterial } from "../../testing/offline-client";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(
  resolveTestDatabaseUrl(),
  "restaurant offline credentials",
);

describe.skipIf(!reachable)("restaurant staff: offline PIN credentials", () => {
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

  const locationId = () => scenario.seed.locations.a;
  const scope = () => ({ organizationId: scenario.seed.organizationId, locationId: locationId() });

  async function credentials(key: Parameters<typeof scenario.as>[0] = "cashierA") {
    return call(
      restaurantRouter.staff.offlineCredentials,
      { locationId: locationId() },
      { context: await scenario.as(key) },
    );
  }

  const materialOf = (all: OfflineMaterial[], key: keyof typeof scenario.seed.staff) =>
    all.find((entry) => entry.memberId === scenario.seed.staff[key].memberId)!;

  test("lists the Staff of the Location who have a PIN, with salt, params, sealed key and epoch", async () => {
    const { members } = await credentials();

    expect(members.map((entry) => entry.memberId).sort()).toEqual(
      ["owner", "admin", "cashierA", "waiterA"]
        .map((key) => scenario.seed.staff[key as "owner"].memberId)
        .sort(),
    );
    const waiter = materialOf(members, "waiterA");
    expect(waiter).toMatchObject({
      name: expect.any(String),
      role: "waiter",
      params: { kdf: "scrypt", N: 16384, r: 8, p: 1, dkLen: 32 },
      epoch: 1,
    });
    expect(waiter.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(waiter.expiresAt.getTime()).toBeGreaterThan(harness.clock.now().getTime());
  });

  test("a member without a PIN or outside the Location gets no material", async () => {
    const { members } = await credentials();
    const ids = members.map((entry) => entry.memberId);
    expect(ids).not.toContain(scenario.seed.staff.waiterB.memberId);
  });

  test("the correct PIN opens the sealed key to the server's offline key, a wrong one does not", async () => {
    const { members } = await credentials();
    const waiter = materialOf(members, "waiterA");

    const opened = openOffline(waiter, "4821", scope());

    const expected = deriveOfflineKey(TEST_ACTING_TOKEN_SECRET, {
      ...scope(),
      memberId: waiter.memberId,
      binding: scenario.seed.staff.cashierA.memberId,
      epoch: waiter.epoch,
    });
    expect(opened ? toHex(opened) : null).toBe(toHex(expected));
    expect(openOffline(waiter, "4822", scope())).toBeNull();
  });

  test("the material never contains the PIN, its stored hash or the server secret", async () => {
    const { members } = await credentials();
    const [row] = await harness.db
      .select()
      .from(schema.staffPin)
      .where(eq(schema.staffPin.memberId, scenario.seed.staff.waiterA.memberId));
    const [, hashKey] = row!.pinHash.split(":") as [string, string];

    const json = JSON.stringify(members);

    expect(json).not.toContain(row!.pinHash);
    expect(json).not.toContain(hashKey);
    expect(json).not.toContain(Buffer.from(hashKey, "hex").toString("base64url"));
    expect(json).not.toContain(TEST_ACTING_TOKEN_SECRET);
    expect(json).not.toContain("pinHash");
    expect(Object.keys(members[0]!).sort()).toEqual([
      "epoch",
      "expiresAt",
      "memberId",
      "name",
      "params",
      "role",
      "salt",
      "sealedKey",
    ]);
  });

  test("material fetched by one login does not open for another (bound to the caller)", async () => {
    const mine = materialOf((await credentials("cashierA")).members, "waiterA");
    const theirs = materialOf((await credentials("admin")).members, "waiterA");

    const key = openOffline(mine, "4821", scope())!;
    const other = openOffline(theirs, "4821", scope())!;

    expect(toHex(key)).not.toBe(toHex(other));
  });

  test("it needs order:take and access to the Location", async () => {
    const code = async (promise: Promise<unknown>) => {
      try {
        await promise;
      } catch (error) {
        return error instanceof ORPCError ? error.code : "NOT_AN_ORPC_ERROR";
      }
      return undefined;
    };
    expect(
      await code(
        call(
          restaurantRouter.staff.offlineCredentials,
          { locationId: scenario.seed.locations.b },
          { context: await scenario.as("waiterA") },
        ),
      ),
    ).toBe("FORBIDDEN");
  });

  describe("epoch", () => {
    const epochOf = async (key: keyof typeof scenario.seed.staff) =>
      materialOf((await credentials("admin")).members, key).epoch;

    test("rotates when the PIN changes or is reset, only for that member", async () => {
      const before = await epochOf("waiterA");
      const cashierBefore = await epochOf("cashierA");

      await call(
        restaurantRouter.staff.setPin,
        { pin: "1357", currentPin: "4821" },
        { context: await scenario.as("waiterA") },
      );
      expect(await epochOf("waiterA")).toBe(before + 1);

      await call(
        restaurantRouter.staff.resetPin,
        { memberId: scenario.seed.staff.waiterA.memberId, pin: "2468" },
        { context: await scenario.as("admin") },
      );
      expect(await epochOf("waiterA")).toBe(before + 2);
      expect(await epochOf("cashierA")).toBe(cashierBefore);
    });

    test("the new PIN opens the new material and the old one no longer does", async () => {
      await call(
        restaurantRouter.staff.resetPin,
        { memberId: scenario.seed.staff.waiterA.memberId, pin: "2468" },
        { context: await scenario.as("admin") },
      );
      const waiter = materialOf((await credentials()).members, "waiterA");

      expect(openOffline(waiter, "2468", scope())).not.toBeNull();
      expect(openOffline(waiter, "4821", scope())).toBeNull();
    });

    test("rotates when the member is removed from a Location", async () => {
      const before = await epochOf("cashierA");
      await call(
        restaurantRouter.staff.unassign,
        { memberId: scenario.seed.staff.cashierA.memberId, locationId: locationId() },
        { context: await scenario.as("admin") },
      );
      const [row] = await harness.db
        .select()
        .from(schema.staffPin)
        .where(eq(schema.staffPin.memberId, scenario.seed.staff.cashierA.memberId));
      expect(row!.offlineEpoch).toBe(before + 1);

      await call(
        restaurantRouter.staff.assignLocations,
        { memberId: scenario.seed.staff.waiterA.memberId, locationIds: [] },
        { context: await scenario.as("admin") },
      );
      const [waiterRow] = await harness.db
        .select()
        .from(schema.staffPin)
        .where(eq(schema.staffPin.memberId, scenario.seed.staff.waiterA.memberId));
      expect(waiterRow!.offlineEpoch).toBe(2);
    });

    test("rotates for the Staff of a Location when one of its devices is revoked", async () => {
      const owner = await scenario.as("owner");
      const created = await call(
        restaurantRouter.devices.createPairing,
        {
          locationId: locationId(),
          name: "Cocina",
          stationIds: [scenario.service.stations.kitchen],
        },
        { context: owner },
      );
      const waiterBefore = await epochOf("waiterA");
      const otherBefore = await harness.db
        .select()
        .from(schema.staffPin)
        .where(eq(schema.staffPin.memberId, scenario.seed.staff.waiterB.memberId));

      await call(
        restaurantRouter.devices.revoke,
        { deviceId: created.deviceId },
        { context: owner },
      );

      expect(await epochOf("waiterA")).toBe(waiterBefore + 1);
      expect(otherBefore).toHaveLength(0);
    });
  });
});
