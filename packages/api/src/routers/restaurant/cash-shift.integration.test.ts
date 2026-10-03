import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { seedBillingScenario } from "../../testing/billing-fixtures";
import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(
  resolveTestDatabaseUrl(),
  "restaurant cash shift",
);

type Tender = "cash" | "card" | "qr_transfer";

describe.skipIf(!reachable)("restaurant cash shift: open, ledger and close", () => {
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

  type StaffKey = Parameters<typeof scenario.as>[0];

  const pay = async (tender: Tender, amount: number, extra: Record<string, unknown> = {}) =>
    call(
      restaurantRouter.billing.recordPayment,
      {
        tableSessionId: sessionId,
        tender,
        amount,
        idempotencyKey: scenario.nextKey(),
        ...(tender === "cash" ? {} : { reference: "REF-1" }),
        ...extra,
      },
      { context: await scenario.as("cashierA") },
    );

  const ledger = async (cashShiftId: string, key: StaffKey = "cashierA") =>
    call(restaurantRouter.cashShift.ledger, { cashShiftId }, { context: await scenario.as(key) });

  const close = async (
    cashShiftId: string,
    counted: { cash: number; card: number; qr_transfer: number },
    key: StaffKey = "cashierA",
    extra: Record<string, unknown> = {},
  ) =>
    call(
      restaurantRouter.cashShift.close,
      { cashShiftId, counted, ...extra },
      { context: await scenario.as(key) },
    );

  const auditActions = async () =>
    (await harness.db.select().from(schema.auditLog)).map((row) => row.action);

  describe("open", () => {
    test("opens a shift with the opening amount and audits it", async () => {
      const shift = await scenario.openShift(50_000);
      expect(shift).toMatchObject({
        locationId: scenario.seed.locations.a,
        openingAmount: 50_000,
        openedByMemberId: scenario.seed.staff.cashierA.memberId,
        closedAt: null,
      });
      expect(await auditActions()).toContain("cash_shift.opened");
      const current = await call(
        restaurantRouter.cashShift.current,
        { locationId: scenario.seed.locations.a },
        { context: await scenario.as("cashierA") },
      );
      expect(current?.id).toBe(shift.id);
    });

    test("allows one open shift per Location, also under concurrency", async () => {
      await scenario.openShift();
      expect(await scenario.codeOf(scenario.openShift(1_000))).toBe("CONFLICT");

      await harness.db.delete(schema.cashShift);
      const results = await Promise.allSettled([
        scenario.openShift(),
        scenario.openShift(0, "admin"),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    });

    test("the Administrator and the Owner may open, the Waiter may not", async () => {
      expect(await scenario.codeOf(scenario.openShift(0, "waiterA"))).toBe("FORBIDDEN");
      expect((await scenario.openShift(0, "admin")).id).toBeString();
    });

    test("is denied outside the caller's Locations", async () => {
      const code = await scenario.codeOf(
        call(
          restaurantRouter.cashShift.open,
          { locationId: scenario.seed.locations.b, openingAmount: 0 },
          { context: await scenario.as("cashierA") },
        ),
      );
      expect(code).toBe("FORBIDDEN");
    });

    test("a new shift can open after the previous one closed", async () => {
      const first = await scenario.openShift(10_000);
      await close(first.id, { cash: 10_000, card: 0, qr_transfer: 0 });
      expect((await scenario.openShift(20_000)).id).not.toBe(first.id);
    });
  });

  describe("payments attach to the open shift", () => {
    test("a payment joins the Location's open shift", async () => {
      const shift = await scenario.openShift();
      await pay("cash", 5_000);
      const [row] = await harness.db.select().from(schema.payment);
      expect(row?.cashShiftId).toBe(shift.id);
    });

    test("without an open shift the payment is still recorded, unattached until a shift opens", async () => {
      await pay("cash", 5_000);
      const [row] = await harness.db.select().from(schema.payment);
      expect(row?.cashShiftId).toBeNull();
    });

    test("shiftless payments join the next shift opened at that Location, ledger and close included", async () => {
      await pay("cash", 5_000);
      const shift = await scenario.openShift(10_000);
      const [row] = await harness.db.select().from(schema.payment);
      expect(row?.cashShiftId).toBe(shift.id);
      const result = await ledger(shift.id);
      expect(result.takings.cash).toEqual({ amount: 5_000, count: 1 });
      expect(result.expected.cash).toBe(15_000);
      const closed = await close(shift.id, { cash: 15_000, card: 0, qr_transfer: 0 });
      expect(closed.difference).toBe(0);
    });

    test("another Location's shiftless payments are not attached", async () => {
      await pay("cash", 5_000);
      await call(
        restaurantRouter.cashShift.open,
        { locationId: scenario.seed.locations.b, openingAmount: 0 },
        { context: await scenario.as("owner") },
      );
      const [row] = await harness.db.select().from(schema.payment);
      expect(row?.cashShiftId).toBeNull();
    });

    test("a payment after the close does not join the closed shift", async () => {
      const shift = await scenario.openShift(0);
      await close(shift.id, { cash: 0, card: 0, qr_transfer: 0 });
      await pay("cash", 5_000);
      const [row] = await harness.db.select().from(schema.payment);
      expect(row?.cashShiftId).toBeNull();
    });
  });

  describe("ledger", () => {
    test("totals the takings by tender with tips, change and the expected cash", async () => {
      const shift = await scenario.openShift(50_000);
      await call(
        restaurantRouter.billing.setTip,
        { tableSessionId: sessionId, amount: 3_500 },
        { context: await scenario.as("cashierA") },
      );
      await pay("cash", 20_000, { tendered: 25_000 });
      await pay("card", 10_000);
      await pay("qr_transfer", 8_500);

      expect(await ledger(shift.id)).toMatchObject({
        shift: { id: shift.id, openingAmount: 50_000, closedAt: null },
        takings: {
          cash: { amount: 20_000, count: 1 },
          card: { amount: 10_000, count: 1 },
          qr_transfer: { amount: 8_500, count: 1 },
        },
        tips: 3_500,
        changeGiven: 5_000,
        expected: { cash: 70_000, card: 10_000, qr_transfer: 8_500, total: 88_500 },
      });
    });

    test("an empty shift expects only the opening cash", async () => {
      const shift = await scenario.openShift(12_000);
      expect((await ledger(shift.id)).expected).toEqual({
        cash: 12_000,
        card: 0,
        qr_transfer: 0,
        total: 12_000,
      });
    });

    test("is denied to the Waiter and to another organization's shift", async () => {
      const shift = await scenario.openShift();
      expect(await scenario.codeOf(ledger(shift.id, "waiterA"))).toBe("FORBIDDEN");
      expect(await scenario.codeOf(ledger("missing"))).toBe("NOT_FOUND");
    });
  });

  describe("close", () => {
    beforeEach(async () => {
      await scenario.openShift(50_000);
    });

    const openShiftId = async () => (await harness.db.select().from(schema.cashShift))[0]!.id;

    test("counted equal to expected closes without an Override and is audited cash_shift.closed", async () => {
      const id = await openShiftId();
      await pay("cash", 20_000);
      await pay("card", 15_000);
      const closed = await close(id, { cash: 70_000, card: 15_000, qr_transfer: 0 });
      expect(closed).toMatchObject({
        expected: 85_000,
        counted: 85_000,
        difference: 0,
        overrideId: null,
        closedByMemberId: scenario.seed.staff.cashierA.memberId,
      });
      expect(closed.closedAt).toEqual(harness.clock.now());
      const actions = await auditActions();
      expect(actions).toContain("cash_shift.closed");
      expect(actions).not.toContain("cash_shift.closed_with_difference");
    });

    test("a difference is refused without an Override and the shift stays open", async () => {
      const id = await openShiftId();
      await pay("cash", 20_000);
      expect(await scenario.codeOf(close(id, { cash: 60_000, card: 0, qr_transfer: 0 }))).toBe(
        "FORBIDDEN",
      );
      const [row] = await harness.db.select().from(schema.cashShift);
      expect(row?.closedAt).toBeNull();
    });

    test("a wrong Override leaves the shift open and the Override unspent", async () => {
      const id = await openShiftId();
      await pay("cash", 20_000);
      const wrong = await scenario.mintOverride("close_shift_difference", "another-target");
      expect(
        await scenario.codeOf(
          close(id, { cash: 60_000, card: 0, qr_transfer: 0 }, "cashierA", { overrideId: wrong }),
        ),
      ).toBe("FORBIDDEN");
      const [override] = await harness.db
        .select()
        .from(schema.override)
        .where(eq(schema.override.id, wrong));
      expect(override?.usedAt).toBeNull();
      expect((await harness.db.select().from(schema.cashShift))[0]?.closedAt).toBeNull();
    });

    test("with an Override it closes with the signed difference and audits closed_with_difference", async () => {
      const id = await openShiftId();
      await pay("cash", 20_000);
      const overrideId = await scenario.mintOverride("close_shift_difference", id);
      const closed = await close(id, { cash: 65_000, card: 0, qr_transfer: 0 }, "cashierA", {
        overrideId,
      });
      expect(closed).toMatchObject({
        expected: 70_000,
        counted: 65_000,
        difference: -5_000,
        overrideId,
      });
      const events = (await harness.db.select().from(schema.auditLog)).filter(
        (row) => row.action === "cash_shift.closed_with_difference",
      );
      expect(events).toHaveLength(1);
      expect(events[0]?.metadata).toMatchObject({
        difference: -5_000,
        overrideId,
        approverMemberId: scenario.seed.staff.admin.memberId,
      });
      expect(await auditActions()).not.toContain("cash_shift.closed");
    });

    test("offsetting differences on two tenders still need an Override", async () => {
      const id = await openShiftId();
      await pay("card", 10_000);
      expect(await scenario.codeOf(close(id, { cash: 60_000, card: 0, qr_transfer: 0 }))).toBe(
        "FORBIDDEN",
      );
    });

    test("closing twice is refused and the Waiter may not close", async () => {
      const id = await openShiftId();
      expect(
        await scenario.codeOf(close(id, { cash: 50_000, card: 0, qr_transfer: 0 }, "waiterA")),
      ).toBe("FORBIDDEN");
      await close(id, { cash: 50_000, card: 0, qr_transfer: 0 });
      expect(await scenario.codeOf(close(id, { cash: 50_000, card: 0, qr_transfer: 0 }))).toBe(
        "CONFLICT",
      );
    });
  });

  describe("offline-registered takings", () => {
    test("lists only the payments flagged offline in the shift", async () => {
      const shift = await scenario.openShift();
      await pay("cash", 5_000);
      await pay("card", 6_000, {
        registeredOffline: true,
        clientRecordedAt: new Date("2026-10-02T14:00:00Z"),
      });
      const rows = await call(
        restaurantRouter.cashShift.offlineTakings,
        { cashShiftId: shift.id },
        { context: await scenario.as("cashierA") },
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        tender: "card",
        amount: 6_000,
        reference: "REF-1",
        clientRecordedAt: new Date("2026-10-02T14:00:00Z"),
      });
    });
  });
});
