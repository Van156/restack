import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { signActingToken } from "../../lib/acting-token";
import { isLocationOnline, recordStaffSeen } from "../../lib/location-presence";
import {
  createGuestCall,
  getGuestState,
  WAITER_CALL_COOLDOWN_MS,
} from "../../lib/waiter-call-guest";
import { seedService } from "../../testing/orders-fixtures";
import type { ServiceSeed } from "../../testing/orders-fixtures";
import {
  createRestaurantHarness,
  TEST_ACTING_TOKEN_SECRET,
} from "../../testing/restaurant-fixtures";
import type { RestaurantHarness, RestaurantSeed } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "waiter call staff");

const SECOND_MS = 1000;

describe.skipIf(!reachable)("waiter call: staff side", () => {
  let harness: RestaurantHarness;
  let seed: RestaurantSeed;
  let service: ServiceSeed;
  let sessionId: string;
  let guestToken: string;

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
    ({ id: sessionId } = await call(
      restaurantRouter.orders.openSession,
      { locationId: seed.locations.a, tableId: service.tables.t1 },
      { context: await as("waiterA") },
    ));
    ({ token: guestToken } = await call(
      restaurantRouter.waiterCall.qr,
      { tableSessionId: sessionId },
      { context: await as("waiterA") },
    ));
  });

  const as = (key: keyof RestaurantSeed["staff"]) =>
    harness.contextFor(seed.staff[key].userId, seed.organizationId);
  const later = (ms: number) => harness.clock.setNow(new Date(harness.clock.now().getTime() + ms));
  const guestDeps = () => ({
    db: harness.db,
    clock: harness.clock,
    secret: TEST_ACTING_TOKEN_SECRET,
  });

  async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
    try {
      await promise;
    } catch (error) {
      return error instanceof ORPCError ? error.code : "NOT_AN_ORPC_ERROR";
    }
    return undefined;
  }

  /** Someone is at the restaurant right now, so guests can call. */
  const online = () =>
    recordStaffSeen(harness.db, harness.clock, {
      organizationId: seed.organizationId,
      locationId: seed.locations.a,
      memberId: seed.staff.waiterB.memberId,
    });

  /** A guest call through the same path the public routes use. */
  async function guestCalls(reason: "need_something" | "cutlery_napkins" | "pay" = "pay") {
    await online();
    const result = await createGuestCall(guestDeps(), guestToken, { reason, fingerprint: "f" });
    expect(result.kind).toBe("created");
    const [row] = await harness.db
      .select()
      .from(schema.waiterCall)
      .where(eq(schema.waiterCall.tableSessionId, sessionId));
    return row!;
  }

  const list = async (key: keyof RestaurantSeed["staff"], locationId = seed.locations.a) =>
    call(restaurantRouter.waiterCall.list, { locationId }, { context: await as(key) });
  const voy = async (key: keyof RestaurantSeed["staff"], callId: string, actingToken?: string) =>
    call(
      restaurantRouter.waiterCall.acknowledge,
      { callId, actingToken },
      { context: await as(key) },
    );
  const atendido = async (key: keyof RestaurantSeed["staff"], callId: string) =>
    call(restaurantRouter.waiterCall.resolve, { callId }, { context: await as(key) });

  describe("list", () => {
    test("shows the open calls of the Location with Table, reason, status and age", async () => {
      await guestCalls("cutlery_napkins");
      const calls = await list("waiterA");
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        tableSessionId: sessionId,
        tableId: service.tables.t1,
        tableName: "M1",
        reason: "cutlery_napkins",
        status: "open",
        createdAt: harness.clock.now(),
        acknowledgedAt: null,
        acknowledgedByMemberId: null,
      });
    });

    test("attended calls drop off the list; on-the-way ones stay, oldest first", async () => {
      const first = await guestCalls("pay");
      const second = await call(
        restaurantRouter.orders.openSession,
        { locationId: seed.locations.a, tableId: service.tables.t2 },
        { context: await as("waiterA") },
      );
      later(5 * SECOND_MS);
      const secondQr = await call(
        restaurantRouter.waiterCall.qr,
        { tableSessionId: second.id },
        { context: await as("waiterA") },
      );
      await online();
      await createGuestCall(guestDeps(), secondQr.token, {
        reason: "need_something",
        fingerprint: "g",
      });
      await voy("waiterA", first.id);
      expect((await list("waiterA")).map((row) => row.status)).toEqual(["on_the_way", "open"]);
      await atendido("waiterA", first.id);
      expect((await list("waiterA")).map((row) => row.tableName)).toEqual(["M2"]);
    });

    test("is Location-scoped", async () => {
      await guestCalls();
      expect(await codeOf(list("waiterB", seed.locations.a))).toBe("FORBIDDEN");
      expect(await list("waiterB", seed.locations.b)).toEqual([]);
    });

    test("polling it marks the Location online for the guests", async () => {
      expect(await isLocationOnline(harness.db, harness.clock, seed.locations.a)).toBe(false);
      await list("waiterA");
      expect(await isLocationOnline(harness.db, harness.clock, seed.locations.a)).toBe(true);
    });
  });

  describe('"Voy"', () => {
    test("moves the call on the way and records who and when", async () => {
      const row = await guestCalls();
      later(7 * SECOND_MS);
      const answered = await voy("waiterA", row.id);
      expect(answered).toMatchObject({
        status: "on_the_way",
        acknowledgedByMemberId: seed.staff.waiterA.memberId,
        acknowledgedAt: harness.clock.now(),
      });
      expect(await getGuestState(guestDeps(), guestToken, "f")).toMatchObject({
        state: { call: { status: "on_the_way" } },
      });
    });

    test("answering again is a no-op that keeps the first Waiter", async () => {
      const row = await guestCalls();
      await voy("waiterA", row.id);
      later(3 * SECOND_MS);
      const again = await voy("cashierA", row.id);
      expect(again.acknowledgedByMemberId).toBe(seed.staff.waiterA.memberId);
    });

    test("an acting member from a PIN switch-in is the one recorded", async () => {
      const row = await guestCalls();
      const { token } = signActingToken(
        TEST_ACTING_TOKEN_SECRET,
        {
          organizationId: seed.organizationId,
          locationId: seed.locations.a,
          memberId: seed.staff.cashierA.memberId,
        },
        harness.clock.now(),
      );
      const answered = await voy("waiterA", row.id, token);
      expect(answered.acknowledgedByMemberId).toBe(seed.staff.cashierA.memberId);
    });

    test("an attended call cannot be answered", async () => {
      const row = await guestCalls();
      await atendido("waiterA", row.id);
      expect(await codeOf(voy("waiterA", row.id))).toBe("CONFLICT");
    });

    test("Staff of another Location and unknown ids are refused", async () => {
      const row = await guestCalls();
      expect(await codeOf(voy("waiterB", row.id))).toBe("FORBIDDEN");
      expect(await codeOf(voy("waiterA", "missing"))).toBe("NOT_FOUND");
      const [unchanged] = await harness.db.select().from(schema.waiterCall);
      expect(unchanged!.status).toBe("open");
    });
  });

  describe('"Atendido"', () => {
    test("closes the call, records who and when, and starts the cooldown", async () => {
      const row = await guestCalls();
      await voy("waiterA", row.id);
      later(20 * SECOND_MS);
      const done = await atendido("waiterA", row.id);
      expect(done).toMatchObject({
        status: "attended",
        resolvedByMemberId: seed.staff.waiterA.memberId,
        resolvedAt: harness.clock.now(),
        cooldownUntil: new Date(harness.clock.now().getTime() + WAITER_CALL_COOLDOWN_MS),
      });
    });

    test("can close a call that was never answered with Voy", async () => {
      const row = await guestCalls();
      expect((await atendido("waiterA", row.id)).status).toBe("attended");
    });

    test("repeating it changes nothing", async () => {
      const row = await guestCalls();
      const first = await atendido("waiterA", row.id);
      later(5 * SECOND_MS);
      const second = await atendido("cashierA", row.id);
      expect(second.resolvedAt).toEqual(first.resolvedAt);
      expect(second.resolvedByMemberId).toBe(seed.staff.waiterA.memberId);
    });

    test("the guest then waits the cooldown before calling again", async () => {
      const row = await guestCalls();
      await atendido("waiterA", row.id);
      later(SECOND_MS);
      await online();
      const during = await createGuestCall(guestDeps(), guestToken, {
        reason: "pay",
        fingerprint: "f",
      });
      expect(during).toMatchObject({ kind: "refused", reason: "cooldown" });
      later(WAITER_CALL_COOLDOWN_MS);
      await online();
      const after = await createGuestCall(guestDeps(), guestToken, {
        reason: "pay",
        fingerprint: "f",
      });
      expect(after.kind).toBe("created");
    });

    test("Staff of another Location are refused", async () => {
      const row = await guestCalls();
      expect(await codeOf(atendido("waiterB", row.id))).toBe("FORBIDDEN");
    });
  });
});
