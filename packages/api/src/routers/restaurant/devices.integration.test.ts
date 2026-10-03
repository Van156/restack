import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { authenticateDevice } from "../../lib/device-auth";
import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness, RestaurantSeed } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "restaurant devices");

const MINUTE_MS = 60 * 1000;

describe.skipIf(!reachable)("restaurant paired devices", () => {
  let harness: RestaurantHarness;
  let seed: RestaurantSeed;
  let stationIds: { kitchen: string; bar: string; otherLocation: string };

  beforeAll(async () => {
    harness = await createRestaurantHarness();
  });
  afterAll(async () => {
    await harness.close();
  });
  beforeEach(async () => {
    await harness.reset();
    seed = await harness.seedRestaurant();
    const insert = async (locationId: string, name: string) => {
      const [row] = await harness.db
        .insert(schema.station)
        .values({ organizationId: seed.organizationId, locationId, name })
        .returning();
      return row!.id;
    };
    stationIds = {
      kitchen: await insert(seed.locations.a, "Cocina"),
      bar: await insert(seed.locations.a, "Bar"),
      otherLocation: await insert(seed.locations.b, "Cocina B"),
    };
  });

  const as = (key: keyof RestaurantSeed["staff"]) =>
    harness.contextFor(seed.staff[key].userId, seed.organizationId);
  const anonymous = async () => ({ ...(await as("owner")), session: null });

  async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
    try {
      await promise;
    } catch (error) {
      return error instanceof ORPCError ? error.code : "NOT_AN_ORPC_ERROR";
    }
    return undefined;
  }

  async function createPairing(key: keyof RestaurantSeed["staff"] = "admin") {
    return call(
      restaurantRouter.devices.createPairing,
      { locationId: seed.locations.a, name: "Pantalla cocina", stationIds: [stationIds.kitchen] },
      { context: await as(key) },
    );
  }

  async function redeem(code: string) {
    return call(restaurantRouter.devices.redeem, { code }, { context: await anonymous() });
  }

  test("an Administrator creates a pairing code that is stored only as a hash", async () => {
    const pairing = await createPairing();
    expect(pairing.code).toMatch(/^[A-Z0-9]{8}$/);
    expect(pairing.expiresAt.getTime()).toBe(harness.clock.now().getTime() + 15 * MINUTE_MS);
    const [row] = await harness.db
      .select()
      .from(schema.pairedDevice)
      .where(eq(schema.pairedDevice.id, pairing.deviceId));
    expect(row!.status).toBe("pending");
    expect(JSON.stringify(row)).not.toContain(pairing.code);
  });

  test("a Waiter cannot create a pairing code, nor an Administrator for another Location", async () => {
    expect(await codeOf(createPairing("waiterA"))).toBe("FORBIDDEN");
    const code = await codeOf(
      call(
        restaurantRouter.devices.createPairing,
        { locationId: seed.locations.b, name: "X", stationIds: [stationIds.otherLocation] },
        { context: await as("admin") },
      ),
    );
    expect(code).toBe("FORBIDDEN");
  });

  test("Stations must belong to the chosen Location and at least one is required", async () => {
    const create = async (ids: string[]) =>
      codeOf(
        call(
          restaurantRouter.devices.createPairing,
          { locationId: seed.locations.a, name: "X", stationIds: ids },
          { context: await as("admin") },
        ),
      );
    expect(await create([stationIds.otherLocation])).toBe("BAD_REQUEST");
    expect(await create([])).toBe("BAD_REQUEST");
  });

  test("redeeming the code without a session returns a device token, audited as paired", async () => {
    const pairing = await createPairing();
    const result = await redeem(pairing.code);
    expect(result.deviceToken.length).toBeGreaterThan(20);
    expect(result.device).toMatchObject({
      id: pairing.deviceId,
      locationId: seed.locations.a,
      stationIds: [stationIds.kitchen],
    });
    const [row] = await harness.db
      .select()
      .from(schema.pairedDevice)
      .where(eq(schema.pairedDevice.id, pairing.deviceId));
    expect(row!.status).toBe("active");
    expect(JSON.stringify(row)).not.toContain(result.deviceToken);
    expect(harness.auditLogger.events.some((e) => e.action === "device.paired")).toBe(true);
  });

  test("a pairing code works once, and not after it expires or for an unknown value", async () => {
    const pairing = await createPairing();
    await redeem(pairing.code);
    expect(await codeOf(redeem(pairing.code))).toBe("NOT_FOUND");
    expect(await codeOf(redeem("ZZZZZZZZ"))).toBe("NOT_FOUND");

    const expired = await createPairing();
    harness.clock.setNow(new Date(harness.clock.now().getTime() + 16 * MINUTE_MS));
    expect(await codeOf(redeem(expired.code))).toBe("NOT_FOUND");
  });

  test("redeeming is throttled per code and per source, and recovers with the clock", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await codeOf(redeem("ZZZZZZZZ"))).toBe("NOT_FOUND");
    }
    expect(await codeOf(redeem("ZZZZZZZZ"))).toBe("TOO_MANY_REQUESTS");

    const pairing = await createPairing();
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await codeOf(redeem(`CODE${attempt}`));
    }
    expect(await codeOf(redeem(pairing.code))).toBe("TOO_MANY_REQUESTS");

    harness.clock.setNow(new Date(harness.clock.now().getTime() + 16 * MINUTE_MS));
    const fresh = await createPairing();
    expect((await redeem(fresh.code)).deviceToken.length).toBeGreaterThan(20);
  });

  test("a device token resolves to its Location and Stations until revoked", async () => {
    const pairing = await createPairing();
    const { deviceToken } = await redeem(pairing.code);

    const resolved = await authenticateDevice(harness.db, harness.clock, deviceToken);
    expect(resolved).toMatchObject({
      deviceId: pairing.deviceId,
      organizationId: seed.organizationId,
      locationId: seed.locations.a,
      stationIds: [stationIds.kitchen],
    });
    expect(await authenticateDevice(harness.db, harness.clock, "bogus")).toBeNull();

    await call(
      restaurantRouter.devices.revoke,
      { deviceId: pairing.deviceId },
      { context: await as("admin") },
    );
    expect(await authenticateDevice(harness.db, harness.clock, deviceToken)).toBeNull();
    expect(harness.auditLogger.events.some((e) => e.action === "device.revoked")).toBe(true);
  });

  test("authenticating a device records when it was last seen", async () => {
    const pairing = await createPairing();
    const { deviceToken } = await redeem(pairing.code);
    harness.clock.setNow(new Date(harness.clock.now().getTime() + 3 * MINUTE_MS));
    await authenticateDevice(harness.db, harness.clock, deviceToken);
    const [row] = await harness.db
      .select()
      .from(schema.pairedDevice)
      .where(eq(schema.pairedDevice.id, pairing.deviceId));
    expect(row!.lastSeenAt?.getTime()).toBe(harness.clock.now().getTime());
  });

  test("a revoked pending device can no longer be redeemed", async () => {
    const pairing = await createPairing();
    await call(
      restaurantRouter.devices.revoke,
      { deviceId: pairing.deviceId },
      { context: await as("admin") },
    );
    expect(await codeOf(redeem(pairing.code))).toBe("NOT_FOUND");
  });

  test("devices are listed, renamed and scoped per Location, without secrets", async () => {
    const pairing = await createPairing();
    await redeem(pairing.code);
    await call(
      restaurantRouter.devices.rename,
      { deviceId: pairing.deviceId, name: "Cocina caliente" },
      { context: await as("admin") },
    );
    const listed = await call(
      restaurantRouter.devices.list,
      { locationId: seed.locations.a },
      { context: await as("admin") },
    );
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ name: "Cocina caliente", status: "active" });
    expect(JSON.stringify(listed)).not.toContain("Hash");

    expect(
      await codeOf(
        call(
          restaurantRouter.devices.list,
          { locationId: seed.locations.a },
          { context: await as("waiterB") },
        ),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await codeOf(
        call(
          restaurantRouter.devices.revoke,
          { deviceId: pairing.deviceId },
          { context: await as("waiterA") },
        ),
      ),
    ).toBe("FORBIDDEN");
  });
});
