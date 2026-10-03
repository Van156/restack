import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import {
  BILLING_TEST_PIN,
  BILLING_TEST_TOTAL,
  seedBillingScenario,
} from "../../testing/billing-fixtures";
import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "restaurant billing");

describe.skipIf(!reachable)("restaurant billing: Bill and tips", () => {
  let harness: RestaurantHarness;
  let scenario: Awaited<ReturnType<typeof seedBillingScenario>>;
  let sessionId: string;

  beforeAll(async () => {
    harness = await createRestaurantHarness();
  });
  afterAll(async () => {
    await harness.close();
  });
  beforeEach(async () => {
    scenario = await seedBillingScenario(harness);
    sessionId = await scenario.openSession();
  });

  const getBill = async (key: Parameters<typeof scenario.as>[0] = "cashierA", id = sessionId) =>
    call(
      restaurantRouter.billing.getBill,
      { tableSessionId: id },
      { context: await scenario.as(key) },
    );

  const setTip = async (
    amount: number,
    key: Parameters<typeof scenario.as>[0] = "cashierA",
    extra = {},
  ) =>
    call(
      restaurantRouter.billing.setTip,
      { tableSessionId: sessionId, amount, ...extra },
      { context: await scenario.as(key) },
    );

  describe("getBill", () => {
    test("itemizes the consumption with impoconsumo per line and the tip outside the tax base", async () => {
      const bill = await getBill();
      expect(bill).toMatchObject({
        status: "open",
        subtotal: BILLING_TEST_TOTAL,
        discountTotal: 0,
        total: BILLING_TEST_TOTAL,
        base: 32_408,
        tax: 2_592,
        tip: 0,
        payable: BILLING_TEST_TOTAL,
        paid: 0,
        balanceDue: BILLING_TEST_TOTAL,
      });
      expect(bill.lines.map((line) => [line.itemName, line.total, line.base, line.tax])).toEqual([
        ["Hamburguesa", 20_000, 18_519, 1_481],
        ["Cerveza", 6_000, 5_556, 444],
        ["Papas", 9_000, 8_333, 667],
      ]);
    });

    test("voided lines are not billed", async () => {
      const view = await call(
        restaurantRouter.orders.getSession,
        { tableSessionId: sessionId },
        { context: await scenario.as("waiterA") },
      );
      const beer = view.lines.find((line) => line.itemName === "Cerveza")!;
      await call(
        restaurantRouter.orders.voidLine,
        { lineId: beer.id, idempotencyKey: scenario.nextKey() },
        { context: await scenario.as("waiterA") },
      );
      const bill = await getBill();
      expect(bill.total).toBe(29_000);
      expect(bill.lines.map((line) => line.itemName)).toEqual(["Hamburguesa", "Papas"]);
    });

    test("a discount lowers the total and the tax base, and is capped at the Bill total", async () => {
      const overrideId = await scenario.mintOverride("discount", sessionId, "waiterA");
      await call(
        restaurantRouter.orders.applyDiscount,
        { tableSessionId: sessionId, kind: "amount", value: 3_500, overrideId },
        { context: await scenario.as("waiterA") },
      );
      const discounted = await getBill();
      expect(discounted).toMatchObject({ discountTotal: 3_500, total: 31_500 });
      expect(discounted.base + discounted.tax).toBe(31_500);

      const second = await scenario.mintOverride("discount", sessionId, "waiterA");
      await call(
        restaurantRouter.orders.applyDiscount,
        { tableSessionId: sessionId, kind: "amount", value: 900_000, overrideId: second },
        { context: await scenario.as("waiterA") },
      );
      const capped = await getBill();
      expect(capped).toMatchObject({
        discountTotal: BILLING_TEST_TOTAL,
        total: 0,
        base: 0,
        tax: 0,
      });
    });

    test("suggests the Location's tip percent of the total", async () => {
      expect((await getBill()).suggestedTip).toEqual({ percent: 10, amount: 3_500 });
      await harness.db
        .update(schema.location)
        .set({ suggestedTipPercent: 5 })
        .where(eq(schema.location.id, scenario.seed.locations.a));
      expect((await getBill()).suggestedTip).toEqual({ percent: 5, amount: 1_750 });
    });

    test("is limited to the caller's Locations; the Owner sees every Location", async () => {
      expect(await scenario.codeOf(getBill("waiterB"))).toBe("FORBIDDEN");
      expect((await getBill("owner")).total).toBe(BILLING_TEST_TOTAL);
      expect(await scenario.codeOf(getBill("cashierA", "missing"))).toBe("NOT_FOUND");
    });
  });

  describe("tips", () => {
    test("setting a tip adds it to the amount to pay without touching tax or total", async () => {
      await setTip(3_500);
      const bill = await getBill();
      expect(bill).toMatchObject({
        tip: 3_500,
        total: BILLING_TEST_TOTAL,
        tax: 2_592,
        payable: 38_500,
        balanceDue: 38_500,
      });
    });

    test("the customer can change the tip, and removing it needs no Override", async () => {
      await setTip(3_500);
      await setTip(1_000);
      expect((await getBill()).tip).toBe(1_000);
      const removed = await call(
        restaurantRouter.billing.removeTip,
        { tableSessionId: sessionId },
        { context: await scenario.as("cashierA") },
      );
      expect(removed.tip).toBe(0);
      expect((await getBill()).payable).toBe(BILLING_TEST_TOTAL);
    });

    /** Holds the Bill row lock like a payment in flight; `change` must not finish until it is released. */
    const expectWaitsForBillLock = async (change: () => Promise<unknown>) => {
      await setTip(1_000);
      const [bill] = await harness.db.select().from(schema.bill);
      let release!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve));
      let locked!: () => void;
      const lockTaken = new Promise<void>((resolve) => (locked = resolve));
      const holder = harness.db.transaction(async (tx) => {
        await tx.select().from(schema.bill).where(eq(schema.bill.id, bill!.id)).for("update");
        locked();
        await held;
      });
      await lockTaken;

      let done = false;
      const pending = change().then(() => (done = true));
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(done).toBe(false);
      release();
      await holder;
      await pending;
      expect(done).toBe(true);
    };

    test("setting the tip waits for the Bill lock that payments hold", async () => {
      await expectWaitsForBillLock(() => setTip(2_000));
    });

    test("removing the tip waits for the Bill lock that payments hold", async () => {
      await expectWaitsForBillLock(async () =>
        call(
          restaurantRouter.billing.removeTip,
          { tableSessionId: sessionId },
          { context: await scenario.as("cashierA") },
        ),
      );
    });

    test("a tip must be a non-negative whole number of pesos", async () => {
      expect(await scenario.codeOf(setTip(-1))).toBe("BAD_REQUEST");
      expect(await scenario.codeOf(setTip(10.5))).toBe("BAD_REQUEST");
      expect((await getBill()).tip).toBe(0);
    });

    test("the tip is attributed to the member who switched in", async () => {
      const { actingToken } = await call(
        restaurantRouter.staff.switchIn,
        {
          locationId: scenario.seed.locations.a,
          memberId: scenario.seed.staff.admin.memberId,
          pin: BILLING_TEST_PIN,
        },
        { context: await scenario.as("cashierA") },
      );
      await setTip(2_000, "cashierA", { actingToken });
      const [row] = await harness.db.select().from(schema.bill);
      expect(row).toMatchObject({
        tipAmount: 2_000,
        tipUpdatedByMemberId: scenario.seed.staff.admin.memberId,
        tipUpdatedAt: harness.clock.now(),
      });
    });

    test("a Waiter can set a tip only when the Location lets waiters charge", async () => {
      expect(await scenario.codeOf(setTip(1_000, "waiterA"))).toBe("FORBIDDEN");
      await harness.db
        .update(schema.location)
        .set({ waitersCanCharge: true })
        .where(eq(schema.location.id, scenario.seed.locations.a));
      await setTip(1_000, "waiterA");
      expect((await getBill()).tip).toBe(1_000);
    });

    test("a Staff member of another Location cannot change the tip", async () => {
      expect(await scenario.codeOf(setTip(1_000, "waiterB"))).toBe("FORBIDDEN");
    });
  });
});
