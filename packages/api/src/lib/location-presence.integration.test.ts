import { hashSecret } from "@base-template/auth/staff-credentials";
import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { restaurantRouter } from "../routers/restaurant/index";
import { createRestaurantHarness } from "../testing/restaurant-fixtures";
import type { RestaurantHarness, RestaurantSeed } from "../testing/restaurant-fixtures";
import { authenticateDevice } from "./device-auth";
import {
  isLocationOnline,
  LOCATION_ONLINE_THRESHOLD_MS,
  recordStaffSeen,
  STAFF_PRESENCE_REFRESH_MS,
} from "./location-presence";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "location presence");

const SECOND_MS = 1000;

describe.skipIf(!reachable)("Location online state", () => {
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

  const online = (locationId = seed.locations.a) =>
    isLocationOnline(harness.db, harness.clock, locationId);
  const later = (ms: number) => harness.clock.setNow(new Date(harness.clock.now().getTime() + ms));

  async function pairDevice(locationId: string) {
    const token = `device-token-${locationId}`;
    await harness.db.insert(schema.pairedDevice).values({
      organizationId: seed.organizationId,
      locationId,
      name: "Cocina",
      status: "active",
      tokenHash: hashSecret(token),
      createdByUserId: seed.staff.admin.userId,
    });
    return token;
  }

  test("a Location nobody has been seen at is offline", async () => {
    expect(await online()).toBe(false);
  });

  test("a Paired device seen within the threshold makes the Location online, then it lapses", async () => {
    const token = await pairDevice(seed.locations.a);
    await authenticateDevice(harness.db, harness.clock, token);
    expect(await online()).toBe(true);
    later(LOCATION_ONLINE_THRESHOLD_MS - SECOND_MS);
    expect(await online()).toBe(true);
    later(2 * SECOND_MS);
    expect(await online()).toBe(false);
  });

  test("a Staff client polling the floor plan makes the Location online, then it lapses", async () => {
    await call(
      restaurantRouter.orders.listOpenSessions,
      { locationId: seed.locations.a },
      { context: await harness.contextFor(seed.staff.waiterA.userId, seed.organizationId) },
    );
    expect(await online()).toBe(true);
    later(LOCATION_ONLINE_THRESHOLD_MS + SECOND_MS);
    expect(await online()).toBe(false);
  });

  test("presence at one Location says nothing about another", async () => {
    const token = await pairDevice(seed.locations.b);
    await authenticateDevice(harness.db, harness.clock, token);
    await recordStaffSeen(harness.db, harness.clock, {
      organizationId: seed.organizationId,
      locationId: seed.locations.b,
      memberId: seed.staff.waiterB.memberId,
    });
    expect(await online(seed.locations.b)).toBe(true);
    expect(await online(seed.locations.a)).toBe(false);
  });

  test("a revoked device does not count even if it was seen a moment ago", async () => {
    const token = await pairDevice(seed.locations.a);
    await authenticateDevice(harness.db, harness.clock, token);
    await harness.db
      .update(schema.pairedDevice)
      .set({ status: "revoked" })
      .where(eq(schema.pairedDevice.locationId, seed.locations.a));
    expect(await online()).toBe(false);
  });

  test("Staff presence is refreshed at most once per refresh interval", async () => {
    const seen = {
      organizationId: seed.organizationId,
      locationId: seed.locations.a,
      memberId: seed.staff.waiterA.memberId,
    };
    const first = harness.clock.now();
    await recordStaffSeen(harness.db, harness.clock, seen);
    later(STAFF_PRESENCE_REFRESH_MS - SECOND_MS);
    await recordStaffSeen(harness.db, harness.clock, seen);
    const [unchanged] = await harness.db.select().from(schema.staffPresence);
    expect(unchanged!.lastSeenAt.getTime()).toBe(first.getTime());
    later(2 * SECOND_MS);
    await recordStaffSeen(harness.db, harness.clock, seen);
    const rows = await harness.db.select().from(schema.staffPresence);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.lastSeenAt.getTime()).toBe(harness.clock.now().getTime());
  });
});
