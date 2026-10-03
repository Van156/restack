import { createRateLimiter } from "@base-template/api/lib/rate-limit";
import { recordStaffSeen } from "@base-template/api/lib/location-presence";
import { TABLE_SESSION_TOKEN_TTL_HOURS } from "@base-template/api/lib/table-session-token";
import { restaurantRouter } from "@base-template/api/routers/restaurant/index";
import { waiterCallProbe } from "@base-template/api/testing/waiter-call-fixtures";
import { seedService } from "@base-template/api/testing/orders-fixtures";
import type { ServiceSeed } from "@base-template/api/testing/orders-fixtures";
import {
  createRestaurantHarness,
  TEST_ACTING_TOKEN_SECRET,
} from "@base-template/api/testing/restaurant-fixtures";
import type {
  RestaurantHarness,
  RestaurantSeed,
} from "@base-template/api/testing/restaurant-fixtures";
import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Hono } from "hono";

import { createWaiterCallRoutes } from "./waiter-call-routes";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "public waiter call");

const SECOND_MS = 1000;
const HOUR_MS = 60 * 60 * 1000;
const SPANISH_REASONS = ["Necesito algo", "Más cubiertos o servilletas", "Quiero pagar"];

describe.skipIf(!reachable)("public Waiter call", () => {
  let harness: RestaurantHarness;
  let seed: RestaurantSeed;
  let service: ServiceSeed;
  let routes: Hono;
  let sessionId: string;
  let token: string;

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
    routes = createWaiterCallRoutes({
      db: harness.db,
      clock: harness.clock,
      secret: TEST_ACTING_TOKEN_SECRET,
      rateLimiter: createRateLimiter(harness.clock),
    });
    const waiter = await harness.contextFor(seed.staff.waiterA.userId, seed.organizationId);
    ({ id: sessionId } = await call(
      restaurantRouter.orders.openSession,
      { locationId: seed.locations.a, tableId: service.tables.t1 },
      { context: waiter },
    ));
    ({ token } = await call(
      restaurantRouter.waiterCall.qr,
      { tableSessionId: sessionId },
      { context: waiter },
    ));
    await staffAtTheRestaurant();
  });

  const later = (ms: number) => harness.clock.setNow(new Date(harness.clock.now().getTime() + ms));

  function staffAtTheRestaurant() {
    return recordStaffSeen(harness.db, harness.clock, {
      organizationId: seed.organizationId,
      locationId: seed.locations.a,
      memberId: seed.staff.waiterA.memberId,
    });
  }

  const get = (value = token, source = "203.0.113.7") =>
    routes.request(`/${value}`, { headers: { "x-forwarded-for": source } });
  const post = (reason: unknown, value = token, source = "203.0.113.7") =>
    routes.request(`/${value}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": source },
      body: JSON.stringify({ reason }),
    });
  const probe = () => waiterCallProbe(harness, sessionId);
  const calls = () => probe().calls();

  describe("valid token", () => {
    test("the state shows the Table name and the three reasons in Spanish, with the button enabled", async () => {
      const response = await get();
      expect(response.status).toBe(200);
      const body = (await response.json()) as { reasons: { label: string }[] };
      expect(body).toMatchObject({
        status: "open",
        table: { name: "M1" },
        call: null,
        canCall: true,
      });
      expect(body.reasons.map((reason) => reason.label)).toEqual(SPANISH_REASONS);
    });

    test("a guest creates a call with a reason and then sees it open with the button disabled", async () => {
      const created = await post("pay");
      expect(created.status).toBe(201);
      expect(await created.json()).toMatchObject({
        status: "open",
        call: { reason: "pay", status: "open" },
        canCall: false,
      });
      const [row] = await calls();
      expect(row).toMatchObject({
        reason: "pay",
        status: "open",
        locationId: seed.locations.a,
        createdAt: harness.clock.now(),
      });
      expect(row!.guestFingerprint).not.toContain("203.0.113.7");
      expect(await (await get()).json()).toMatchObject({ call: { reason: "pay" }, canCall: false });
    });

    test("only one call stays open per Table session", async () => {
      expect((await post("pay")).status).toBe(201);
      const second = await post("need_something");
      expect(second.status).toBe(409);
      expect(await second.json()).toMatchObject({ status: "call_open" });
      expect(await calls()).toHaveLength(1);
    });

    test("an unknown reason or body is a bad request and creates nothing", async () => {
      expect((await post("free-drink")).status).toBe(400);
      const raw = await routes.request(`/${token}`, { method: "POST", body: "not json" });
      expect(raw.status).toBe(400);
      expect(await calls()).toHaveLength(0);
    });

    test("after the Waiter answers, the guest sees it on the way without Staff names or ids", async () => {
      await post("need_something");
      await probe().changeCalls({
        status: "on_the_way",
        acknowledgedAt: harness.clock.now(),
        acknowledgedByMemberId: seed.staff.waiterA.memberId,
      });
      const text = await (await get()).text();
      expect(JSON.parse(text)).toMatchObject({
        call: { reason: "need_something", status: "on_the_way" },
      });
      expect(text).not.toContain(seed.staff.waiterA.memberId);
      expect(text).not.toContain(seed.staff.waiterA.userId);
    });

    test("the public page exposes the call function only: no ids, menu, order or price", async () => {
      await call(
        restaurantRouter.orders.addLine,
        {
          tableSessionId: sessionId,
          menuItemId: service.items.fries,
          quantity: 1,
          idempotencyKey: "line-1",
        },
        { context: await harness.contextFor(seed.staff.waiterA.userId, seed.organizationId) },
      );
      await post("pay");
      const body = (await (await get()).json()) as { table: object };
      expect(Object.keys(body).sort()).toEqual(
        ["call", "canCall", "cooldownUntil", "reasons", "status", "table"].sort(),
      );
      expect(Object.keys(body.table)).toEqual(["name"]);
      const text = JSON.stringify(body);
      for (const secret of [
        sessionId,
        seed.organizationId,
        seed.locations.a,
        "Papas",
        "9000",
        "9 000",
      ]) {
        expect(text).not.toContain(secret);
      }
    });
  });

  describe("expired token", () => {
    test("is refused for the state and for a call", async () => {
      later(TABLE_SESSION_TOKEN_TTL_HOURS * HOUR_MS + SECOND_MS);
      await staffAtTheRestaurant();
      expect((await get()).status).toBe(404);
      expect((await post("pay")).status).toBe(404);
      expect(await calls()).toHaveLength(0);
    });
  });

  describe("regenerated QR", () => {
    test("the old token stops working and the new one works", async () => {
      const waiter = await harness.contextFor(seed.staff.waiterA.userId, seed.organizationId);
      const fresh = await call(
        restaurantRouter.waiterCall.regenerateQr,
        { tableSessionId: sessionId },
        { context: waiter },
      );
      expect((await get()).status).toBe(404);
      expect((await post("pay")).status).toBe(404);
      expect((await get(fresh.token)).status).toBe(200);
      expect((await post("pay", fresh.token)).status).toBe(201);
    });
  });

  describe("settled Bill", () => {
    const settle = () => probe().settleSession();

    test("the state says the Table closed, with no button and no Table name", async () => {
      await settle();
      const response = await get();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        status: "closed",
        message: "Esta mesa ya cerró. Gracias por venir.",
      });
    });

    test("a call is refused", async () => {
      await settle();
      const response = await post("pay");
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ status: "closed" });
      expect(await calls()).toHaveLength(0);
    });
  });

  describe("offline Location", () => {
    test("with nothing seen, the state hides the call and says to wave", async () => {
      await probe().forgetStaffPresence();
      const response = await get();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        status: "offline",
        message: "El restaurante está sin conexión. Llama a tu mesero con la mano.",
      });
    });

    test("a call is refused while offline and works once someone is back", async () => {
      later(40 * SECOND_MS);
      const refused = await post("pay");
      expect(refused.status).toBe(409);
      expect(await refused.json()).toMatchObject({ status: "offline" });
      expect(await calls()).toHaveLength(0);
      await staffAtTheRestaurant();
      expect((await post("pay")).status).toBe(201);
    });
  });

  describe("cooldown", () => {
    test("after a call is attended the guest waits, then can call again", async () => {
      await post("pay");
      await probe().changeCalls({
        status: "attended",
        resolvedAt: harness.clock.now(),
        cooldownUntil: new Date(harness.clock.now().getTime() + 30 * SECOND_MS),
      });
      expect(await (await get()).json()).toMatchObject({ canCall: false, call: null });
      const refused = await post("pay");
      expect(refused.status).toBe(409);
      expect(await refused.json()).toMatchObject({ status: "cooldown", retryAfterSeconds: 30 });
      later(31 * SECOND_MS);
      await staffAtTheRestaurant();
      expect(await (await get()).json()).toMatchObject({ canCall: true });
      expect((await post("need_something")).status).toBe(201);
    });
  });

  describe("forged or foreign tokens", () => {
    test("garbage, a bad signature and a token for a missing session are all the same 404", async () => {
      const [payload] = token.split(".") as [string];
      for (const value of ["garbage", `${payload}.AAAA`, "a.b.c"]) {
        const response = await get(value);
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ status: "invalid" });
      }
    });
  });

  describe("rate limiting", () => {
    test("calls are limited per token with a generic throttled answer", async () => {
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 8; attempt += 1) {
        statuses.push((await post("pay")).status);
      }
      expect(statuses.slice(0, 6)).not.toContain(429);
      expect(statuses.slice(6)).toEqual([429, 429]);
      const throttled = await post("pay");
      expect(await throttled.json()).toEqual({ status: "throttled" });
      expect(throttled.headers.get("retry-after")).toBe("60");
    });

    test("a window that has passed lets the token through again", async () => {
      for (let attempt = 0; attempt < 7; attempt += 1) {
        await post("pay");
      }
      later(61 * SECOND_MS);
      await staffAtTheRestaurant();
      expect((await post("pay")).status).not.toBe(429);
    });

    test("one source is limited across tokens, and other sources are unaffected", async () => {
      let last = 0;
      for (let attempt = 0; attempt < 601; attempt += 1) {
        last = (await get("garbage", "198.51.100.9")).status;
      }
      expect(last).toBe(429);
      expect((await get(token, "198.51.100.10")).status).toBe(200);
    });
  });
});
