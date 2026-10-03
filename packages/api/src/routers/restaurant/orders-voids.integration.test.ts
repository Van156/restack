import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { seedService } from "../../testing/orders-fixtures";
import type { ServiceSeed } from "../../testing/orders-fixtures";
import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness, RestaurantSeed } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "restaurant orders");

const MINUTE_MS = 60 * 1000;

describe.skipIf(!reachable)("restaurant orders: voids, discounts and guards", () => {
  let harness: RestaurantHarness;
  let seed: RestaurantSeed;
  let service: ServiceSeed;
  let sessionId: string;
  let keyCounter = 0;

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
    for (const key of ["admin", "owner", "waiterA"] as const) {
      await call(restaurantRouter.staff.setPin, { pin: "4821" }, { context: await as(key) });
    }
    sessionId = (
      await call(
        restaurantRouter.orders.openSession,
        { locationId: seed.locations.a, tableId: service.tables.t1 },
        { context: await as("waiterA") },
      )
    ).id;
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

  const nextKey = () => `key-${(keyCounter += 1)}`;

  async function line(menuItemId = service.items.beer, send = true) {
    const created = await call(
      restaurantRouter.orders.addLine,
      { tableSessionId: sessionId, menuItemId, quantity: 1, idempotencyKey: nextKey() },
      { context: await as("waiterA") },
    );
    if (send) {
      await call(
        restaurantRouter.orders.sendToKitchen,
        { tableSessionId: sessionId },
        { context: await as("waiterA") },
      );
    }
    return created;
  }

  async function mintOverride(
    action: "void_line" | "discount",
    target: string,
    requester: keyof RestaurantSeed["staff"] = "waiterA",
    approver: keyof RestaurantSeed["staff"] = "admin",
  ) {
    const { overrideId } = await call(
      restaurantRouter.overrides.mint,
      {
        locationId: seed.locations.a,
        action,
        target,
        approverMemberId: seed.staff[approver].memberId,
        approverPin: "4821",
      },
      { context: await as(requester) },
    );
    return overrideId;
  }

  async function voidLine(
    lineId: string,
    overrides: Partial<{
      overrideId: string;
      idempotencyKey: string;
      actingToken: string;
      reason: string;
    }> = {},
    key: keyof RestaurantSeed["staff"] = "waiterA",
  ) {
    return call(
      restaurantRouter.orders.voidLine,
      { lineId, reason: "cliente cambió de opinión", idempotencyKey: nextKey(), ...overrides },
      { context: await as(key) },
    );
  }

  describe("voiding a sent line", () => {
    test("needs a valid Override: the line is voided, attributed, audited and the Override spent", async () => {
      const sent = await line();
      const overrideId = await mintOverride("void_line", sent.id);
      const voided = await voidLine(sent.id, { overrideId });
      expect(voided).toMatchObject({
        orderLineId: sent.id,
        overrideId,
        reason: "cliente cambió de opinión",
        recordedByMemberId: seed.staff.waiterA.memberId,
        recordedAt: harness.clock.now(),
      });
      const view = await call(
        restaurantRouter.orders.getSession,
        { tableSessionId: sessionId },
        { context: await as("waiterA") },
      );
      expect(view.lines.find((row) => row.id === sent.id)!.voided).toBe(true);

      const event = harness.auditLogger.events.find((e) => e.action === "order_line.voided");
      expect(event).toMatchObject({
        targetType: "order_line",
        targetId: sent.id,
        actorUserId: seed.staff.waiterA.userId,
      });
      expect(event!.metadata).toMatchObject({
        approverMemberId: seed.staff.admin.memberId,
        overrideId,
      });
      const used = await harness.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.action, "override.used"));
      expect(used).toHaveLength(1);

      // Single use: the same Override cannot void another sent line.
      const other = await line(service.items.fries);
      expect(await codeOf(voidLine(other.id, { overrideId }))).toBe("FORBIDDEN");
    });

    test("without an Override the void is refused", async () => {
      const sent = await line();
      expect(await codeOf(voidLine(sent.id))).toBe("FORBIDDEN");
    });

    test("an Override bound to another line or an expired one is refused and nothing is voided", async () => {
      const sent = await line();
      const other = await line(service.items.fries);
      const wrongTarget = await mintOverride("void_line", other.id);
      expect(await codeOf(voidLine(sent.id, { overrideId: wrongTarget }))).toBe("FORBIDDEN");

      const expiring = await mintOverride("void_line", sent.id);
      harness.clock.setNow(new Date(harness.clock.now().getTime() + 10 * MINUTE_MS));
      expect(await codeOf(voidLine(sent.id, { overrideId: expiring }))).toBe("FORBIDDEN");

      const voids = await harness.db.select().from(schema.orderLineVoid);
      expect(voids).toEqual([]);
      // The refused attempt did not burn the Override that was bound correctly.
      const [wrong] = await harness.db
        .select()
        .from(schema.override)
        .where(eq(schema.override.id, wrongTarget));
      expect(wrong!.usedAt).toBeNull();
    });

    test("an Override for another action cannot void a line", async () => {
      const sent = await line();
      const discountOverride = await mintOverride("discount", sent.id);
      expect(await codeOf(voidLine(sent.id, { overrideId: discountOverride }))).toBe("FORBIDDEN");
    });

    test("replaying the same key returns the same void without spending another Override", async () => {
      const sent = await line();
      const overrideId = await mintOverride("void_line", sent.id);
      const first = await voidLine(sent.id, { overrideId, idempotencyKey: "void-1" });
      const replay = await voidLine(sent.id, { idempotencyKey: "void-1" });
      expect(replay.id).toBe(first.id);
      expect(await codeOf(voidLine(sent.id, { overrideId }))).toBe("CONFLICT");
    });

    test("the void is attributed to the member who switched in", async () => {
      const sent = await line();
      const overrideId = await mintOverride("void_line", sent.id, "admin", "owner");
      const { actingToken } = await call(
        restaurantRouter.staff.switchIn,
        { locationId: seed.locations.a, memberId: seed.staff.waiterA.memberId, pin: "4821" },
        { context: await as("admin") },
      );
      const voided = await voidLine(sent.id, { overrideId, actingToken }, "admin");
      expect(voided.recordedByMemberId).toBe(seed.staff.waiterA.memberId);
    });

    test("Staff of another Location cannot void", async () => {
      const sent = await line();
      expect(await codeOf(voidLine(sent.id, {}, "waiterB"))).toBe("FORBIDDEN");
    });
  });

  describe("voiding an unsent line", () => {
    test("is just a removal: no Override and no audit event", async () => {
      const draft = await line(service.items.beer, false);
      const voided = await voidLine(draft.id);
      expect(voided.overrideId).toBeNull();
      expect(harness.auditLogger.events.some((e) => e.action === "order_line.voided")).toBe(false);
    });
  });

  describe("discounts", () => {
    const discount = async (
      overrides: Partial<{
        kind: "amount" | "percent";
        value: number;
        overrideId: string;
      }>,
      key: keyof RestaurantSeed["staff"] = "waiterA",
    ) =>
      call(
        restaurantRouter.orders.applyDiscount,
        { tableSessionId: sessionId, kind: "percent", value: 10, overrideId: "none", ...overrides },
        { context: await as(key) },
      );

    test("needs an Override: the discount is recorded with approver and author, and audited", async () => {
      await line();
      const overrideId = await mintOverride("discount", sessionId);
      const result = await discount({ kind: "percent", value: 15, overrideId });
      expect(result).toMatchObject({
        tableSessionId: sessionId,
        kind: "percent",
        value: 15,
        overrideId,
        approverMemberId: seed.staff.admin.memberId,
        recordedByMemberId: seed.staff.waiterA.memberId,
      });
      expect(harness.auditLogger.events.find((e) => e.action === "discount.applied")).toMatchObject(
        {
          targetType: "table_session",
          targetId: sessionId,
        },
      );
      const view = await call(
        restaurantRouter.orders.getSession,
        { tableSessionId: sessionId },
        { context: await as("waiterA") },
      );
      expect(view.discounts).toHaveLength(1);
    });

    test("an amount discount is recorded in COP", async () => {
      const overrideId = await mintOverride("discount", sessionId);
      const result = await discount({ kind: "amount", value: 3_000, overrideId });
      expect(result).toMatchObject({ kind: "amount", value: 3_000 });
    });

    test("an invalid, reused or misbound Override is refused and nothing is recorded", async () => {
      expect(await codeOf(discount({ overrideId: "made-up" }))).toBe("FORBIDDEN");
      const wrongAction = await mintOverride("void_line", sessionId);
      expect(await codeOf(discount({ overrideId: wrongAction }))).toBe("FORBIDDEN");
      const overrideId = await mintOverride("discount", sessionId);
      await discount({ overrideId });
      expect(await codeOf(discount({ overrideId }))).toBe("FORBIDDEN");
      expect(await harness.db.select().from(schema.discount)).toHaveLength(1);
    });

    test("a percent above 100 or a non-positive value is rejected before the Override is spent", async () => {
      const overrideId = await mintOverride("discount", sessionId);
      expect(await codeOf(discount({ kind: "percent", value: 101, overrideId }))).toBe(
        "BAD_REQUEST",
      );
      expect(await codeOf(discount({ kind: "amount", value: 0, overrideId }))).toBe("BAD_REQUEST");
      await discount({ overrideId });
    });

    test("a settled session takes no discount; another Location is refused", async () => {
      const overrideId = await mintOverride("discount", sessionId);
      expect(await codeOf(discount({ overrideId }, "waiterB"))).toBe("FORBIDDEN");
      await harness.db
        .update(schema.tableSession)
        .set({ status: "settled", settledAt: harness.clock.now() })
        .where(eq(schema.tableSession.id, sessionId));
      expect(await codeOf(discount({ overrideId }))).toBe("CONFLICT");
    });
  });

  describe("deletion guards", () => {
    test("an Area with an open Table session cannot be deleted, nor can its Table", async () => {
      expect(
        await codeOf(
          call(
            restaurantRouter.areas.delete,
            { areaId: service.areaId },
            { context: await as("owner") },
          ),
        ),
      ).toBe("CONFLICT");
      expect(
        await codeOf(
          call(
            restaurantRouter.tables.delete,
            { tableId: service.tables.t1 },
            { context: await as("owner") },
          ),
        ),
      ).toBe("CONFLICT");
      expect(await harness.db.select().from(schema.area)).toHaveLength(2);
    });

    test("a requested bill still blocks the Area", async () => {
      await call(
        restaurantRouter.orders.requestBill,
        { tableSessionId: sessionId },
        { context: await as("waiterA") },
      );
      expect(
        await codeOf(
          call(
            restaurantRouter.areas.delete,
            { areaId: service.areaId },
            { context: await as("owner") },
          ),
        ),
      ).toBe("CONFLICT");
    });

    test("a Table with settled history cannot be deleted either, so Bills never disappear", async () => {
      await harness.db
        .update(schema.tableSession)
        .set({ status: "settled", settledAt: harness.clock.now() })
        .where(eq(schema.tableSession.id, sessionId));
      expect(
        await codeOf(
          call(
            restaurantRouter.tables.delete,
            { tableId: service.tables.t1 },
            { context: await as("owner") },
          ),
        ),
      ).toBe("CONFLICT");
      expect(
        await codeOf(
          call(
            restaurantRouter.areas.delete,
            { areaId: service.areaId },
            { context: await as("owner") },
          ),
        ),
      ).toBe("CONFLICT");
    });

    test("an Area without sessions is still deleted with its Tables", async () => {
      const result = await call(
        restaurantRouter.areas.delete,
        { areaId: service.areaBId },
        { context: await as("owner") },
      );
      expect(result).toEqual({ deleted: true });
    });
  });
});
