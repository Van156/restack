import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

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
});
