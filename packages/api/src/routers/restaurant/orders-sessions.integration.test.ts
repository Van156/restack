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

describe.skipIf(!reachable)("restaurant orders: Table sessions", () => {
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

  async function open(key: keyof RestaurantSeed["staff"], tableId: string) {
    return call(
      restaurantRouter.orders.openSession,
      { locationId: tableId === service.tables.b1 ? seed.locations.b : seed.locations.a, tableId },
      { context: await as(key) },
    );
  }

  describe("opening", () => {
    test("a Waiter opens a Table session, recorded with the clock and the Waiter", async () => {
      const session = await open("waiterA", service.tables.t1);
      expect(session).toMatchObject({
        tableId: service.tables.t1,
        locationId: seed.locations.a,
        status: "open",
        openedByMemberId: seed.staff.waiterA.memberId,
        openedAt: harness.clock.now(),
      });
      expect(session.shortCode).toMatch(/^[A-Z0-9]{4,8}$/);
    });

    test("a Table has at most one open session; other Tables are unaffected", async () => {
      await open("waiterA", service.tables.t1);
      expect(await codeOf(open("cashierA", service.tables.t1))).toBe("CONFLICT");
      await open("cashierA", service.tables.t2);
    });

    test("a Table is free again once its session is settled", async () => {
      const first = await open("waiterA", service.tables.t1);
      await harness.db
        .update(schema.tableSession)
        .set({ status: "settled", settledAt: harness.clock.now() })
        .where(eq(schema.tableSession.id, first.id));
      const second = await open("waiterA", service.tables.t1);
      expect(second.id).not.toBe(first.id);
    });

    test("Staff of another Location cannot open a session; a foreign Table is not found", async () => {
      expect(
        await codeOf(
          call(
            restaurantRouter.orders.openSession,
            { locationId: seed.locations.a, tableId: service.tables.t1 },
            { context: await as("waiterB") },
          ),
        ),
      ).toBe("FORBIDDEN");
      expect(
        await codeOf(
          call(
            restaurantRouter.orders.openSession,
            { locationId: seed.locations.a, tableId: service.tables.b1 },
            { context: await as("waiterA") },
          ),
        ),
      ).toBe("NOT_FOUND");
    });
  });

  describe("moving and requesting the bill", () => {
    test("a session moves to a free Table of the same Location and frees the old one", async () => {
      const session = await open("waiterA", service.tables.t1);
      const moved = await call(
        restaurantRouter.orders.moveSession,
        { tableSessionId: session.id, tableId: service.tables.t2 },
        { context: await as("waiterA") },
      );
      expect(moved.tableId).toBe(service.tables.t2);
      await open("waiterA", service.tables.t1);
    });

    test("moving onto an occupied Table is refused", async () => {
      const session = await open("waiterA", service.tables.t1);
      await open("waiterA", service.tables.t2);
      expect(
        await codeOf(
          call(
            restaurantRouter.orders.moveSession,
            { tableSessionId: session.id, tableId: service.tables.t2 },
            { context: await as("waiterA") },
          ),
        ),
      ).toBe("CONFLICT");
    });

    test("moving to a Table of another Location is refused", async () => {
      const session = await open("waiterA", service.tables.t1);
      expect(
        await codeOf(
          call(
            restaurantRouter.orders.moveSession,
            { tableSessionId: session.id, tableId: service.tables.b1 },
            { context: await as("owner") },
          ),
        ),
      ).toBe("BAD_REQUEST");
    });

    test("requesting the bill marks the session; asking again changes nothing", async () => {
      const session = await open("waiterA", service.tables.t1);
      const requested = await call(
        restaurantRouter.orders.requestBill,
        { tableSessionId: session.id },
        { context: await as("waiterA") },
      );
      expect(requested.status).toBe("bill_requested");
      const again = await call(
        restaurantRouter.orders.requestBill,
        { tableSessionId: session.id },
        { context: await as("waiterA") },
      );
      expect(again.status).toBe("bill_requested");
      // A session with a requested bill still occupies the Table.
      expect(await codeOf(open("waiterA", service.tables.t1))).toBe("CONFLICT");
    });

    test("a settled session can be neither moved nor have its bill requested", async () => {
      const session = await open("waiterA", service.tables.t1);
      await harness.db
        .update(schema.tableSession)
        .set({ status: "settled", settledAt: harness.clock.now() })
        .where(eq(schema.tableSession.id, session.id));
      expect(
        await codeOf(
          call(
            restaurantRouter.orders.requestBill,
            { tableSessionId: session.id },
            { context: await as("waiterA") },
          ),
        ),
      ).toBe("CONFLICT");
      expect(
        await codeOf(
          call(
            restaurantRouter.orders.moveSession,
            { tableSessionId: session.id, tableId: service.tables.t2 },
            { context: await as("waiterA") },
          ),
        ),
      ).toBe("CONFLICT");
    });

    test("Staff of another Location cannot touch the session", async () => {
      const session = await open("waiterA", service.tables.t1);
      expect(
        await codeOf(
          call(
            restaurantRouter.orders.requestBill,
            { tableSessionId: session.id },
            { context: await as("waiterB") },
          ),
        ),
      ).toBe("FORBIDDEN");
    });
  });

  describe("reading", () => {
    test("open sessions of a Location list with their Table and status, never settled ones", async () => {
      const first = await open("waiterA", service.tables.t1);
      await open("waiterA", service.tables.t2);
      await harness.db
        .update(schema.tableSession)
        .set({ status: "settled", settledAt: harness.clock.now() })
        .where(eq(schema.tableSession.id, first.id));
      const list = await call(
        restaurantRouter.orders.listOpenSessions,
        { locationId: seed.locations.a },
        { context: await as("waiterA") },
      );
      expect(list.map((row) => row.tableId)).toEqual([service.tables.t2]);
      expect(list[0]!.status).toBe("open");
    });

    test("listing is Location-scoped", async () => {
      expect(
        await codeOf(
          call(
            restaurantRouter.orders.listOpenSessions,
            { locationId: seed.locations.a },
            { context: await as("waiterB") },
          ),
        ),
      ).toBe("FORBIDDEN");
    });
  });
  describe("acting member on move and bill request", () => {
    async function switchInWaiterA() {
      await call(restaurantRouter.staff.setPin, { pin: "4821" }, { context: await as("waiterA") });
      const { actingToken } = await call(
        restaurantRouter.staff.switchIn,
        { locationId: seed.locations.a, memberId: seed.staff.waiterA.memberId, pin: "4821" },
        { context: await as("cashierA") },
      );
      return actingToken;
    }

    test("moveSession and requestBill accept a valid acting token", async () => {
      const actingToken = await switchInWaiterA();
      const session = await open("cashierA", service.tables.t1);

      const moved = await call(
        restaurantRouter.orders.moveSession,
        { tableSessionId: session.id, tableId: service.tables.t2, actingToken },
        { context: await as("cashierA") },
      );
      expect(moved.tableId).toBe(service.tables.t2);

      const requested = await call(
        restaurantRouter.orders.requestBill,
        { tableSessionId: session.id, actingToken },
        { context: await as("cashierA") },
      );
      expect(requested.status).toBe("bill_requested");
    });

    test("a forged acting token is FORBIDDEN and changes nothing", async () => {
      const session = await open("cashierA", service.tables.t1);

      expect(
        await codeOf(
          call(
            restaurantRouter.orders.moveSession,
            { tableSessionId: session.id, tableId: service.tables.t2, actingToken: "forged" },
            { context: await as("cashierA") },
          ),
        ),
      ).toBe("FORBIDDEN");
      expect(
        await codeOf(
          call(
            restaurantRouter.orders.requestBill,
            { tableSessionId: session.id, actingToken: "forged" },
            { context: await as("cashierA") },
          ),
        ),
      ).toBe("FORBIDDEN");
      const [stored] = await harness.db
        .select()
        .from(schema.tableSession)
        .where(eq(schema.tableSession.id, session.id));
      expect(stored).toMatchObject({ tableId: service.tables.t1, status: "open" });
    });
  });
});
