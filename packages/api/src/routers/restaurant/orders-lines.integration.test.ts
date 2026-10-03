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

describe.skipIf(!reachable)("restaurant orders: lines and kitchen", () => {
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
    for (const key of ["waiterA", "waiterB", "cashierA", "admin"] as const) {
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

  async function addLine(
    key: keyof RestaurantSeed["staff"],
    overrides: Partial<{
      tableSessionId: string;
      menuItemId: string;
      quantity: number;
      modifierIds: string[];
      note: string;
      idempotencyKey: string;
      clientRecordedAt: Date;
      actingToken: string;
    }> = {},
  ) {
    return call(
      restaurantRouter.orders.addLine,
      {
        tableSessionId: sessionId,
        menuItemId: service.items.beer,
        quantity: 1,
        idempotencyKey: nextKey(),
        ...overrides,
      },
      { context: await as(key) },
    );
  }

  const burger = (overrides = {}) =>
    addLine("waiterA", {
      menuItemId: service.items.burger,
      modifierIds: [service.modifiers.medium],
      ...overrides,
    });

  async function sessionView(key: keyof RestaurantSeed["staff"] = "waiterA") {
    return call(
      restaurantRouter.orders.getSession,
      { tableSessionId: sessionId },
      { context: await as(key) },
    );
  }

  async function switchIn(
    by: keyof RestaurantSeed["staff"],
    target: keyof RestaurantSeed["staff"],
    locationId = seed.locations.a,
  ) {
    return call(
      restaurantRouter.staff.switchIn,
      { locationId, memberId: seed.staff[target].memberId, pin: "4821" },
      { context: await as(by) },
    );
  }

  describe("adding lines", () => {
    test("a line records the item, its price, tax class, modifiers with deltas, quantity and note", async () => {
      const recordedAt = new Date("2026-10-02T14:59:00.000Z");
      const line = await burger({
        modifierIds: [service.modifiers.wellDone, service.modifiers.cheese],
        quantity: 2,
        note: "sin cebolla",
        clientRecordedAt: recordedAt,
      });
      expect(line).toMatchObject({
        tableSessionId: sessionId,
        menuItemId: service.items.burger,
        itemName: "Hamburguesa",
        unitPrice: 20_000,
        taxClass: "impoconsumo",
        quantity: 2,
        note: "sin cebolla",
        recordedByMemberId: seed.staff.waiterA.memberId,
        recordedAt: harness.clock.now(),
        clientRecordedAt: recordedAt,
      });
      expect(line.modifiers).toEqual([
        { modifierId: service.modifiers.wellDone, name: "Bien cocido", priceDelta: 0 },
        { modifierId: service.modifiers.cheese, name: "Queso", priceDelta: 2_000 },
      ]);
    });

    test("the price stays as recorded when the menu price changes afterwards", async () => {
      const before = await addLine("waiterA");
      await harness.db
        .update(schema.menuItem)
        .set({ price: 7_500 })
        .where(eq(schema.menuItem.id, service.items.beer));
      const after = await addLine("waiterA");
      const view = await sessionView();
      const priceOf = (id: string) => view.lines.find((line) => line.id === id)!.unitPrice;
      expect(priceOf(before.id)).toBe(6_000);
      expect(priceOf(after.id)).toBe(7_500);
    });

    test("replaying a line with the same idempotency key returns the existing line and adds nothing", async () => {
      const first = await addLine("waiterA", { idempotencyKey: "tap-1", quantity: 2 });
      const replay = await addLine("waiterA", { idempotencyKey: "tap-1", quantity: 2 });
      expect(replay.id).toBe(first.id);
      expect((await sessionView()).lines).toHaveLength(1);
    });

    test("a replay still succeeds after the item sold out, and another session cannot reuse the key", async () => {
      const first = await addLine("waiterA", { idempotencyKey: "tap-2" });
      await call(
        restaurantRouter.menu.setSoldOut,
        { locationId: seed.locations.a, menuItemId: service.items.beer, soldOut: true },
        { context: await as("cashierA") },
      );
      expect((await addLine("waiterA", { idempotencyKey: "tap-2" })).id).toBe(first.id);

      const other = await call(
        restaurantRouter.orders.openSession,
        { locationId: seed.locations.a, tableId: service.tables.t2 },
        { context: await as("waiterA") },
      );
      expect(
        await codeOf(addLine("waiterA", { tableSessionId: other.id, idempotencyKey: "tap-2" })),
      ).toBe("CONFLICT");
    });

    test("a sold-out item cannot be added at that Location until it is restored", async () => {
      await call(
        restaurantRouter.menu.setSoldOut,
        { locationId: seed.locations.a, menuItemId: service.items.beer, soldOut: true },
        { context: await as("cashierA") },
      );
      expect(await codeOf(addLine("waiterA"))).toBe("CONFLICT");
      await call(
        restaurantRouter.menu.setSoldOut,
        { locationId: seed.locations.a, menuItemId: service.items.beer, soldOut: false },
        { context: await as("cashierA") },
      );
      await addLine("waiterA");
    });

    test("a Waiter cannot mark items sold out", async () => {
      expect(
        await codeOf(
          call(
            restaurantRouter.menu.setSoldOut,
            { locationId: seed.locations.a, menuItemId: service.items.beer, soldOut: true },
            { context: await as("waiterA") },
          ),
        ),
      ).toBe("FORBIDDEN");
    });

    test("an inactive or unknown item cannot be added", async () => {
      expect(await codeOf(addLine("waiterA", { menuItemId: service.items.retired }))).toBe(
        "BAD_REQUEST",
      );
      expect(await codeOf(addLine("waiterA", { menuItemId: "missing" }))).toBe("NOT_FOUND");
    });

    test("modifier selections respect each group's limits and belong to the item", async () => {
      expect(await codeOf(addLine("waiterA", { menuItemId: service.items.burger }))).toBe(
        "BAD_REQUEST",
      );
      expect(
        await codeOf(
          addLine("waiterA", {
            menuItemId: service.items.burger,
            modifierIds: [service.modifiers.medium, service.modifiers.wellDone],
          }),
        ),
      ).toBe("BAD_REQUEST");
      expect(
        await codeOf(
          addLine("waiterA", {
            menuItemId: service.items.beer,
            modifierIds: [service.modifiers.cheese],
          }),
        ),
      ).toBe("BAD_REQUEST");
    });

    test("a settled session accepts no new lines", async () => {
      await harness.db
        .update(schema.tableSession)
        .set({ status: "settled", settledAt: harness.clock.now() })
        .where(eq(schema.tableSession.id, sessionId));
      expect(await codeOf(addLine("waiterA"))).toBe("CONFLICT");
    });

    test("Staff of another Location cannot add lines", async () => {
      expect(await codeOf(addLine("waiterB"))).toBe("FORBIDDEN");
    });
  });

  describe("acting member", () => {
    test("with a valid acting token the line is recorded as made by the member who switched in", async () => {
      const { actingToken } = await switchIn("cashierA", "waiterA");
      const line = await addLine("cashierA", { actingToken });
      expect(line.recordedByMemberId).toBe(seed.staff.waiterA.memberId);
    });

    test("without a token the line is recorded as made by the session's member", async () => {
      const line = await addLine("cashierA");
      expect(line.recordedByMemberId).toBe(seed.staff.cashierA.memberId);
    });

    test("an invalid, tampered or expired token is refused", async () => {
      const { actingToken, actingTokenExpiresAt } = await switchIn("cashierA", "waiterA");
      expect(await codeOf(addLine("cashierA", { actingToken: "garbage" }))).toBe("FORBIDDEN");
      expect(
        await codeOf(addLine("cashierA", { actingToken: `${actingToken.slice(0, -2)}xx` })),
      ).toBe("FORBIDDEN");
      harness.clock.setNow(new Date(actingTokenExpiresAt.getTime() + MINUTE_MS));
      expect(await codeOf(addLine("cashierA", { actingToken }))).toBe("FORBIDDEN");
    });

    test("a token for another Location is refused", async () => {
      const { actingToken } = await switchIn("owner", "waiterB", seed.locations.b);
      expect(await codeOf(addLine("owner", { actingToken }))).toBe("FORBIDDEN");
    });

    test("a member unassigned since switching in is refused", async () => {
      const { actingToken } = await switchIn("cashierA", "waiterA");
      await harness.db
        .delete(schema.staffLocationAssignment)
        .where(eq(schema.staffLocationAssignment.memberId, seed.staff.waiterA.memberId));
      expect(await codeOf(addLine("cashierA", { actingToken }))).toBe("FORBIDDEN");
    });
  });

  describe("removing unsent lines", () => {
    test("an unsent line is removed from the order; repeating the removal is a no-op", async () => {
      const line = await addLine("waiterA");
      const input = { lineId: line.id, idempotencyKey: "rm-1" };
      await call(restaurantRouter.orders.removeLine, input, { context: await as("waiterA") });
      await call(restaurantRouter.orders.removeLine, input, { context: await as("waiterA") });
      const view = await sessionView();
      expect(view.lines.find((row) => row.id === line.id)!.voided).toBe(true);
    });

    test("a sent line cannot simply be removed", async () => {
      const line = await addLine("waiterA");
      await call(
        restaurantRouter.orders.sendToKitchen,
        { tableSessionId: sessionId },
        { context: await as("waiterA") },
      );
      expect(
        await codeOf(
          call(
            restaurantRouter.orders.removeLine,
            { lineId: line.id, idempotencyKey: nextKey() },
            { context: await as("waiterA") },
          ),
        ),
      ).toBe("CONFLICT");
    });
  });

  describe("sending to the kitchen", () => {
    const send = async (key: keyof RestaurantSeed["staff"] = "waiterA", extra = {}) =>
      call(
        restaurantRouter.orders.sendToKitchen,
        { tableSessionId: sessionId, ...extra },
        { context: await as(key) },
      );

    test("creates one Ticket per Station with the lines it prepares", async () => {
      const dish = await burger();
      const side = await addLine("waiterA", { menuItemId: service.items.fries });
      const drink = await addLine("waiterA");

      const { tickets } = await send();
      expect(tickets).toHaveLength(2);
      const byStation = new Map(tickets.map((ticket) => [ticket.stationId, ticket]));
      expect(byStation.get(service.stations.kitchen)!.lineIds.toSorted()).toEqual(
        [dish.id, side.id].toSorted(),
      );
      expect(byStation.get(service.stations.bar)!.lineIds).toEqual([drink.id]);
      for (const ticket of tickets) {
        expect(ticket).toMatchObject({
          status: "nuevo",
          tableSessionId: sessionId,
          sentAt: harness.clock.now(),
          sentByMemberId: seed.staff.waiterA.memberId,
        });
      }
      const view = await sessionView();
      expect(view.lines.every((line) => line.ticketId !== null)).toBe(true);
      expect(view.tickets).toHaveLength(2);
    });

    test("only lines not sent yet go on the next send, and sending with nothing new does nothing", async () => {
      await addLine("waiterA");
      await send();
      expect((await send()).tickets).toEqual([]);
      const more = await addLine("waiterA");
      const { tickets } = await send();
      expect(tickets).toHaveLength(1);
      expect(tickets[0]!.lineIds).toEqual([more.id]);
    });

    test("an item without a Station at the Location blocks the whole send", async () => {
      await addLine("waiterA");
      await addLine("waiterA", { menuItemId: service.items.unrouted });
      expect(await codeOf(send())).toBe("CONFLICT");
      const view = await sessionView();
      expect(view.tickets).toEqual([]);
      expect(view.lines.every((line) => line.ticketId === null)).toBe(true);
    });

    test("removed lines are not sent", async () => {
      const kept = await addLine("waiterA", { menuItemId: service.items.fries });
      const dropped = await addLine("waiterA");
      await call(
        restaurantRouter.orders.removeLine,
        { lineId: dropped.id, idempotencyKey: nextKey() },
        { context: await as("waiterA") },
      );
      const { tickets } = await send();
      expect(tickets).toHaveLength(1);
      expect(tickets[0]!.lineIds).toEqual([kept.id]);
    });

    test("the Ticket is attributed to the member who switched in", async () => {
      await addLine("waiterA");
      const { actingToken } = await switchIn("cashierA", "waiterA");
      const { tickets } = await send("cashierA", { actingToken });
      expect(tickets[0]!.sentByMemberId).toBe(seed.staff.waiterA.memberId);
    });

    test("Staff of another Location cannot send", async () => {
      await addLine("waiterA");
      expect(await codeOf(send("waiterB"))).toBe("FORBIDDEN");
    });
  });
});
