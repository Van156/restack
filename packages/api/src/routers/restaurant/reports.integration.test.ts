import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { seedBillingScenario } from "../../testing/billing-fixtures";
import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness } from "../../testing/restaurant-fixtures";
import { sellAndSettle } from "../../testing/sales-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "restaurant reports");

/** 2026-10-02 12:00 in Bogota (UTC-5). */
const NOON = new Date("2026-10-02T17:00:00.000Z");
/** 2026-10-02 23:30 in Bogota: still the 2nd. */
const LATE_NIGHT = new Date("2026-10-03T04:30:00.000Z");
/** 2026-10-03 00:30 in Bogota: already the 3rd. */
const AFTER_MIDNIGHT = new Date("2026-10-03T05:30:00.000Z");

describe.skipIf(!reachable)("restaurant reports: daily by tender", () => {
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

  type StaffKey = Parameters<typeof scenario.as>[0];

  const daily = async (
    input: { locationId?: string; date?: string } = {},
    key: StaffKey = "owner",
  ) => call(restaurantRouter.reports.daily, input, { context: await scenario.as(key) });

  const sell = (
    options: Omit<Parameters<typeof sellAndSettle>[2], "payments"> & {
      payments?: Parameters<typeof sellAndSettle>[2]["payments"];
    },
  ) =>
    sellAndSettle(harness, scenario, {
      payments: [{ tender: "cash", amount: "rest" }],
      ...options,
    });

  test("totals per tender with the tip reported apart from sales", async () => {
    await sell({
      at: NOON,
      tip: 3_500,
      payments: [
        { tender: "cash", amount: 20_000 },
        { tender: "card", amount: "rest" },
      ],
    });
    await sell({
      at: NOON,
      lines: [{ item: "beer" }],
      payments: [{ tender: "qr_transfer", amount: "rest" }],
    });

    const report = await daily({ locationId: scenario.seed.locations.a, date: "2026-10-02" });
    expect(report).toMatchObject({
      date: "2026-10-02",
      billCount: 2,
      salesTotal: 41_000,
      tipTotal: 3_500,
      collectedTotal: 44_500,
      tenders: {
        cash: { count: 1, amount: 20_000 },
        card: { count: 1, amount: 18_500 },
        qr_transfer: { count: 1, amount: 6_000 },
      },
    });
  });

  test("uses the Bogota business day: late night stays on the date, after midnight moves on", async () => {
    await sell({ at: LATE_NIGHT });
    await sell({ at: AFTER_MIDNIGHT });

    const second = await daily({ date: "2026-10-02" });
    const third = await daily({ date: "2026-10-03" });
    expect([second.billCount, third.billCount]).toEqual([1, 1]);
  });

  test("defaults to the business day of the injected clock", async () => {
    await sell({ at: NOON });
    harness.clock.setNow(NOON);
    expect((await daily()).date).toBe("2026-10-02");
    expect((await daily()).billCount).toBe(1);
  });

  test("an open Bill does not count", async () => {
    harness.clock.setNow(NOON);
    const openId = await scenario.openSession();
    await call(
      restaurantRouter.billing.setTip,
      { tableSessionId: openId, amount: 1_000 },
      { context: await scenario.as("cashierA") },
    );
    expect(await daily({ date: "2026-10-02" })).toMatchObject({ billCount: 0, tipTotal: 0 });
  });

  test("a reopened Bill does not count until it settles again", async () => {
    const sessionId = await sell({ at: NOON });
    const overrideId = await scenario.mintOverride("reopen_bill", sessionId);
    await call(
      restaurantRouter.billing.reopen,
      { tableSessionId: sessionId, overrideId },
      { context: await scenario.as("cashierA") },
    );
    expect((await daily({ date: "2026-10-02" })).billCount).toBe(0);
  });

  test("the Owner sees all Locations with a per-Location breakdown; a filter narrows to one", async () => {
    await sell({ at: NOON });
    await sell({
      at: NOON,
      location: "b",
      lines: [{ item: "beer" }],
      payments: [{ tender: "card", amount: "rest" }],
    });

    const all = await daily({ date: "2026-10-02" });
    expect(all.billCount).toBe(2);
    expect(all.byLocation.map((row) => [row.locationId, row.salesTotal])).toEqual([
      [scenario.seed.locations.a, 35_000],
      [scenario.seed.locations.b, 6_000],
    ]);

    const onlyB = await daily({ locationId: scenario.seed.locations.b, date: "2026-10-02" });
    expect(onlyB).toMatchObject({ billCount: 1, salesTotal: 6_000 });
  });

  test("the Administrator is limited to assigned Locations, also without a filter", async () => {
    await sell({ at: NOON });
    await sell({
      at: NOON,
      location: "b",
      lines: [{ item: "beer" }],
      payments: [{ tender: "card", amount: "rest" }],
    });

    const report = await daily({ date: "2026-10-02" }, "admin");
    expect(report.billCount).toBe(1);
    expect(report.byLocation.map((row) => row.locationId)).toEqual([scenario.seed.locations.a]);
    expect(await scenario.codeOf(daily({ locationId: scenario.seed.locations.b }, "admin"))).toBe(
      "FORBIDDEN",
    );
  });

  test("Cashier and Waiter are denied, and a foreign Location is not found for the Owner", async () => {
    expect(await scenario.codeOf(daily({}, "cashierA"))).toBe("FORBIDDEN");
    expect(await scenario.codeOf(daily({}, "waiterA"))).toBe("FORBIDDEN");
    expect(await scenario.codeOf(daily({ locationId: scenario.seed.locations.other }))).toBe(
      "NOT_FOUND",
    );
  });

  test("rejects a malformed date", async () => {
    expect(await scenario.codeOf(daily({ date: "02/10/2026" }))).toBe("BAD_REQUEST");
  });

  test("counts DIAN documents of the day by status and kind", async () => {
    const sessionId = await sell({ at: NOON });
    const [bill] = await harness.db.select().from(schema.bill);
    await harness.db.insert(schema.dianDocument).values([
      {
        organizationId: scenario.seed.organizationId,
        locationId: scenario.seed.locations.a,
        billId: bill!.id,
        kind: "pos_equivalent",
        status: "issued",
        saleTime: NOON,
        payload: {},
      },
      {
        organizationId: scenario.seed.organizationId,
        locationId: scenario.seed.locations.a,
        billId: bill!.id,
        kind: "factura",
        status: "pending",
        saleTime: NOON,
        payload: {},
      },
    ]);
    expect(sessionId).toBeString();

    const report = await daily({ date: "2026-10-02" });
    expect(report.documents).toEqual({
      total: 2,
      byStatus: { pending: 1, issued: 1, rejected: 0 },
      byKind: { pos_equivalent: 1, factura: 1 },
    });
  });

  describe("kitchen metrics", () => {
    const MINUTE_MS = 60_000;

    const kitchen = async (
      input: { locationId?: string; date?: string } = {},
      key: StaffKey = "owner",
    ) => call(restaurantRouter.reports.kitchen, input, { context: await scenario.as(key) });

    async function seedTicket(
      tableSessionId: string,
      locationId: string,
      stationId: string,
      sentAt: Date,
      minutes: { started: number; ready: number; delivered: number },
    ) {
      const at = (offset: number) => new Date(sentAt.getTime() + offset * MINUTE_MS);
      await harness.db.insert(schema.ticket).values({
        organizationId: scenario.seed.organizationId,
        locationId,
        tableSessionId,
        stationId,
        status: "entregado",
        sentAt,
        startedAt: at(minutes.started),
        readyAt: at(minutes.ready),
        deliveredAt: at(minutes.delivered),
      });
    }

    async function seedBothLocations() {
      const sessionA = await sell({ at: NOON });
      await seedTicket(
        sessionA,
        scenario.seed.locations.a,
        scenario.service.stations.kitchen,
        NOON,
        { started: 2, ready: 10, delivered: 13 },
      );
      const sessionB = await sell({
        at: NOON,
        location: "b",
        lines: [{ item: "beer" }],
        payments: [{ tender: "card", amount: "rest" }],
      });
      const [stationB] = await harness.db
        .insert(schema.station)
        .values({
          organizationId: scenario.seed.organizationId,
          locationId: scenario.seed.locations.b,
          name: "Cocina B",
        })
        .returning();
      await seedTicket(sessionB, scenario.seed.locations.b, stationB!.id, NOON, {
        started: 1,
        ready: 5,
        delivered: 6,
      });
    }

    test("summarizes preparation, pickup and sent-to-ready time across all Locations and per Location", async () => {
      await seedBothLocations();
      const report = await kitchen({ date: "2026-10-02" });
      expect(report.total).toMatchObject({
        ticketCount: 2,
        completedCount: 2,
        avgPrepMs: 6 * MINUTE_MS,
        avgPickupMs: 2 * MINUTE_MS,
        avgSentToReadyMs: 7.5 * MINUTE_MS,
        maxSentToReadyMs: 10 * MINUTE_MS,
      });
      expect(report.byLocation.map((row) => [row.locationId, row.ticketCount])).toEqual([
        [scenario.seed.locations.a, 1],
        [scenario.seed.locations.b, 1],
      ]);
      expect(report.byLocation[0]).toMatchObject({ avgPrepMs: 8 * MINUTE_MS });
    });

    test("filters by Location, keys the day on the send time and honors Location scope", async () => {
      await seedBothLocations();
      const onlyB = await kitchen({ locationId: scenario.seed.locations.b, date: "2026-10-02" });
      expect(onlyB.total.ticketCount).toBe(1);
      expect((await kitchen({ date: "2026-10-03" })).total.ticketCount).toBe(0);
      expect((await kitchen({ date: "2026-10-02" }, "admin")).total.ticketCount).toBe(1);
      expect(
        await scenario.codeOf(kitchen({ locationId: scenario.seed.locations.b }, "admin")),
      ).toBe("FORBIDDEN");
      expect(await scenario.codeOf(kitchen({}, "cashierA"))).toBe("FORBIDDEN");
    });
  });

  describe("by Menu item and by Staff member, with cost and margin", () => {
    const byItem = async (
      input: { locationId?: string; date?: string } = {},
      key: StaffKey = "owner",
    ) => call(restaurantRouter.reports.byItem, input, { context: await scenario.as(key) });

    const byStaff = async (
      input: { locationId?: string; date?: string } = {},
      key: StaffKey = "owner",
    ) => call(restaurantRouter.reports.byStaff, input, { context: await scenario.as(key) });

    const setCost = (item: "burger" | "beer" | "fries", cost: number | null) =>
      harness.db
        .update(schema.menuItem)
        .set({ cost })
        .where(eq(schema.menuItem.id, scenario.service.items[item]));

    test("items carry quantity, recorded revenue, cost and margin; a missing cost is flagged, not zero", async () => {
      await setCost("burger", 8_000);
      await setCost("beer", 2_000);
      await sell({ at: NOON });

      const report = await byItem({ date: "2026-10-02" });
      expect(report.items).toEqual([
        {
          menuItemId: scenario.service.items.burger,
          itemName: "Hamburguesa",
          quantity: 1,
          revenue: 20_000,
          cost: 8_000,
          margin: 12_000,
          costMissing: false,
        },
        {
          menuItemId: scenario.service.items.fries,
          itemName: "Papas",
          quantity: 1,
          revenue: 9_000,
          cost: null,
          margin: null,
          costMissing: true,
        },
        {
          menuItemId: scenario.service.items.beer,
          itemName: "Cerveza",
          quantity: 1,
          revenue: 6_000,
          cost: 2_000,
          margin: 4_000,
          costMissing: false,
        },
      ]);
      expect(report.total).toEqual({
        revenue: 35_000,
        costedRevenue: 26_000,
        uncostedRevenue: 9_000,
        cost: 10_000,
        margin: 16_000,
        marginIncomplete: true,
      });
    });

    test("revenue is the recorded price: a later menu price change does not move a past day", async () => {
      await sell({ at: NOON });
      await harness.db.update(schema.menuItem).set({ price: 99_999 });
      const report = await byItem({ date: "2026-10-02" });
      expect(report.total.revenue).toBe(35_000);
    });

    test("a Bill discount lowers the revenue of its lines in proportion and sums to the Bill total", async () => {
      await setCost("burger", 8_000);
      harness.clock.setNow(NOON);
      const sessionId = await scenario.openSession();
      const overrideId = await scenario.mintOverride("discount", sessionId);
      await call(
        restaurantRouter.orders.applyDiscount,
        { tableSessionId: sessionId, kind: "percent", value: 10, overrideId },
        { context: await scenario.as("cashierA") },
      );
      const cashier = await scenario.as("cashierA");
      await call(
        restaurantRouter.billing.recordPayment,
        {
          tableSessionId: sessionId,
          tender: "cash",
          amount: 31_500,
          idempotencyKey: scenario.nextKey(),
        },
        { context: cashier },
      );
      await call(
        restaurantRouter.billing.settle,
        { tableSessionId: sessionId },
        { context: cashier },
      );

      const report = await byItem({ date: "2026-10-02" });
      const burger = report.items.find((item) => item.itemName === "Hamburguesa");
      expect(burger).toMatchObject({ revenue: 18_000, cost: 8_000, margin: 10_000 });
      expect(report.total.revenue).toBe(31_500);
      expect((await daily({ date: "2026-10-02" })).salesTotal).toBe(31_500);
    });

    test("a removed line is not sold", async () => {
      harness.clock.setNow(NOON);
      const sessionId = await scenario.openSession({
        lines: [{ item: "beer" }, { item: "fries" }],
      });
      const view = await call(
        restaurantRouter.orders.getSession,
        { tableSessionId: sessionId },
        { context: await scenario.as("waiterA") },
      );
      const fries = view.lines.find((entry) => entry.itemName === "Papas")!;
      await call(
        restaurantRouter.orders.removeLine,
        { lineId: fries.id, idempotencyKey: scenario.nextKey() },
        { context: await scenario.as("waiterA") },
      );
      const cashier = await scenario.as("cashierA");
      await call(
        restaurantRouter.billing.recordPayment,
        {
          tableSessionId: sessionId,
          tender: "cash",
          amount: 6_000,
          idempotencyKey: scenario.nextKey(),
        },
        { context: cashier },
      );
      await call(
        restaurantRouter.billing.settle,
        { tableSessionId: sessionId },
        { context: cashier },
      );

      const report = await byItem({ date: "2026-10-02" });
      expect(report.items.map((item) => item.itemName)).toEqual(["Cerveza"]);
    });

    test("a deleted Menu item stays in the report under its recorded name, flagged as missing cost", async () => {
      await setCost("beer", 2_000);
      await sell({ at: NOON, lines: [{ item: "beer" }] });
      await harness.db
        .delete(schema.menuItem)
        .where(eq(schema.menuItem.id, scenario.service.items.beer));

      const report = await byItem({ date: "2026-10-02" });
      expect(report.items).toEqual([
        {
          menuItemId: null,
          itemName: "Cerveza",
          quantity: 1,
          revenue: 6_000,
          cost: null,
          margin: null,
          costMissing: true,
        },
      ]);
    });

    test("staff rows name who settled each Bill, with sales, tips and margin", async () => {
      await setCost("beer", 2_000);
      await sell({ at: NOON, lines: [{ item: "beer" }], tip: 600 });
      await sell({
        at: NOON,
        lines: [{ item: "beer" }, { item: "beer" }],
        chargedBy: "admin",
      });

      const report = await byStaff({ date: "2026-10-02" });
      expect(report.staff).toEqual([
        {
          memberId: scenario.seed.staff.admin.memberId,
          name: "admin",
          billCount: 1,
          salesTotal: 12_000,
          tipTotal: 0,
          margin: {
            revenue: 12_000,
            costedRevenue: 12_000,
            uncostedRevenue: 0,
            cost: 4_000,
            margin: 8_000,
            marginIncomplete: false,
          },
        },
        {
          memberId: scenario.seed.staff.cashierA.memberId,
          name: "cashier-a",
          billCount: 1,
          salesTotal: 6_000,
          tipTotal: 600,
          margin: {
            revenue: 6_000,
            costedRevenue: 6_000,
            uncostedRevenue: 0,
            cost: 2_000,
            margin: 4_000,
            marginIncomplete: false,
          },
        },
      ]);
    });

    test("Location filter, all-Locations view and Administrator scope apply to both reports", async () => {
      await sell({ at: NOON, lines: [{ item: "beer" }] });
      await sell({
        at: NOON,
        location: "b",
        lines: [{ item: "fries" }],
        payments: [{ tender: "card", amount: "rest" }],
      });

      expect((await byItem({ date: "2026-10-02" })).total.revenue).toBe(15_000);
      expect(
        (await byItem({ locationId: scenario.seed.locations.b, date: "2026-10-02" })).total.revenue,
      ).toBe(9_000);
      expect((await byStaff({ date: "2026-10-02" })).staff).toHaveLength(2);
      expect((await byItem({ date: "2026-10-02" }, "admin")).total.revenue).toBe(6_000);
      expect((await byStaff({ date: "2026-10-02" }, "admin")).staff).toHaveLength(1);
      expect(
        await scenario.codeOf(byItem({ locationId: scenario.seed.locations.b }, "admin")),
      ).toBe("FORBIDDEN");
      expect(
        await scenario.codeOf(byStaff({ locationId: scenario.seed.locations.b }, "admin")),
      ).toBe("FORBIDDEN");
    });

    test("Cashier and Waiter are denied both reports", async () => {
      for (const key of ["cashierA", "waiterA"] as const) {
        expect(await scenario.codeOf(byItem({}, key))).toBe("FORBIDDEN");
        expect(await scenario.codeOf(byStaff({}, key))).toBe("FORBIDDEN");
      }
    });
  });
});
