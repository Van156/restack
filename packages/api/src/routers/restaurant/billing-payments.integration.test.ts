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

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "restaurant payments");

type Tender = "cash" | "card" | "qr_transfer";

describe.skipIf(!reachable)("restaurant billing: payments, settle and reopen", () => {
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

  const pay = async (
    tender: Tender,
    amount: number,
    extra: Record<string, unknown> = {},
    key: StaffKey = "cashierA",
  ) =>
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
      { context: await scenario.as(key) },
    );

  const getBill = async (key: StaffKey = "cashierA") =>
    call(
      restaurantRouter.billing.getBill,
      { tableSessionId: sessionId },
      { context: await scenario.as(key) },
    );

  const settle = async (key: StaffKey = "cashierA", id = sessionId) =>
    call(
      restaurantRouter.billing.settle,
      { tableSessionId: id },
      { context: await scenario.as(key) },
    );

  const reopen = async (overrideId: string, key: StaffKey = "cashierA", extra = {}) =>
    call(
      restaurantRouter.billing.reopen,
      { tableSessionId: sessionId, overrideId, ...extra },
      { context: await scenario.as(key) },
    );

  describe("recording payments", () => {
    test("exact cash covers the Bill and records no change", async () => {
      const result = await pay("cash", BILLING_TEST_TOTAL);
      expect(result.change).toBe(0);
      expect(result.payment).toMatchObject({
        tender: "cash",
        amount: BILLING_TEST_TOTAL,
        tendered: BILLING_TEST_TOTAL,
        recordedByMemberId: scenario.seed.staff.cashierA.memberId,
      });
      expect(result.bill).toMatchObject({ paid: BILLING_TEST_TOTAL, balanceDue: 0 });
    });

    test("cash records the amount handed over and the change due", async () => {
      const result = await pay("cash", BILLING_TEST_TOTAL, { tendered: 50_000 });
      expect(result.change).toBe(15_000);
      expect(result.payment).toMatchObject({ amount: BILLING_TEST_TOTAL, tendered: 50_000 });
      expect((await getBill()).payments[0]).toMatchObject({ tendered: 50_000, change: 15_000 });
    });

    test("cash handed over cannot be less than the amount covered", async () => {
      expect(await scenario.codeOf(pay("cash", 10_000, { tendered: 9_000 }))).toBe("BAD_REQUEST");
    });

    test("card and QR/transfer need a reference; tendered is for cash only", async () => {
      expect(await scenario.codeOf(pay("card", 10_000, { reference: undefined }))).toBe(
        "BAD_REQUEST",
      );
      expect(await scenario.codeOf(pay("qr_transfer", 10_000, { reference: "  " }))).toBe(
        "BAD_REQUEST",
      );
      expect(await scenario.codeOf(pay("card", 10_000, { tendered: 10_000 }))).toBe("BAD_REQUEST");
      const card = await pay("card", 10_000, { reference: "VOUCHER-889" });
      expect(card.payment).toMatchObject({
        tender: "card",
        reference: "VOUCHER-889",
        tendered: null,
      });
      const transfer = await pay("qr_transfer", 5_000, { reference: "NEQUI-123" });
      expect(transfer.payment.reference).toBe("NEQUI-123");
    });

    test("a Bill can be split across tenders until nothing is due", async () => {
      await pay("cash", 20_000);
      const second = await pay("card", 15_000);
      expect(second.bill).toMatchObject({ paid: 35_000, balanceDue: 0 });
      expect((await getBill()).payments.map((row) => row.tender)).toEqual(["cash", "card"]);
    });

    test("a payment cannot exceed what is still due", async () => {
      await pay("cash", 30_000);
      expect(await scenario.codeOf(pay("card", 5_001))).toBe("CONFLICT");
      expect((await getBill()).balanceDue).toBe(5_000);
    });

    test("the tip is part of what is due", async () => {
      await call(
        restaurantRouter.billing.setTip,
        { tableSessionId: sessionId, amount: 3_500 },
        { context: await scenario.as("cashierA") },
      );
      const result = await pay("cash", 38_500);
      expect(result.bill.balanceDue).toBe(0);
    });

    test("a retry with the same idempotency key returns the stored payment and records nothing twice", async () => {
      const first = await pay("cash", 10_000, { idempotencyKey: "pay-1" });
      const replay = await pay("cash", 10_000, { idempotencyKey: "pay-1" });
      expect(replay.payment.id).toBe(first.payment.id);
      expect(await harness.db.select().from(schema.payment)).toHaveLength(1);
    });

    test("an idempotency key already used for another Bill is a CONFLICT", async () => {
      await pay("cash", 10_000, { idempotencyKey: "pay-1" });
      const other = await scenario.openSession({ tableId: scenario.service.tables.t2 });
      const code = await scenario.codeOf(
        call(
          restaurantRouter.billing.recordPayment,
          { tableSessionId: other, tender: "cash", amount: 5_000, idempotencyKey: "pay-1" },
          { context: await scenario.as("cashierA") },
        ),
      );
      expect(code).toBe("CONFLICT");
    });

    test("an offline payment keeps the device sale time and the offline flag", async () => {
      const clientRecordedAt = new Date("2026-10-02T12:30:00.000Z");
      const result = await pay("cash", 10_000, { registeredOffline: true, clientRecordedAt });
      expect(result.payment).toMatchObject({
        registeredOffline: true,
        clientRecordedAt,
        recordedAt: harness.clock.now(),
      });
    });

    test("the payment is attributed to the member who switched in", async () => {
      const { actingToken } = await call(
        restaurantRouter.staff.switchIn,
        {
          locationId: scenario.seed.locations.a,
          memberId: scenario.seed.staff.admin.memberId,
          pin: BILLING_TEST_PIN,
        },
        { context: await scenario.as("cashierA") },
      );
      const result = await pay("cash", 10_000, { actingToken });
      expect(result.payment.recordedByMemberId).toBe(scenario.seed.staff.admin.memberId);
    });

    test("a Waiter needs the Location flag; another Location is refused", async () => {
      expect(await scenario.codeOf(pay("cash", 1_000, {}, "waiterA"))).toBe("FORBIDDEN");
      expect(await scenario.codeOf(pay("cash", 1_000, {}, "waiterB"))).toBe("FORBIDDEN");
      await harness.db
        .update(schema.location)
        .set({ waitersCanCharge: true })
        .where(eq(schema.location.id, scenario.seed.locations.a));
      expect((await pay("cash", 1_000, {}, "waiterA")).payment.recordedByMemberId).toBe(
        scenario.seed.staff.waiterA.memberId,
      );
    });
  });

  describe("settling", () => {
    test("is refused while something is still due", async () => {
      await pay("cash", 30_000);
      expect(await scenario.codeOf(settle())).toBe("CONFLICT");
    });

    test("is refused for a session with nothing to charge", async () => {
      const empty = await scenario.openSession({ tableId: scenario.service.tables.t2, lines: [] });
      expect(await scenario.codeOf(settle("cashierA", empty))).toBe("CONFLICT");
    });

    test("a fully paid Bill settles: totals are recorded and the Table session is settled and freed", async () => {
      await pay("cash", 20_000);
      await pay("card", 15_000);
      harness.clock.setNow(new Date("2026-10-02T15:40:00.000Z"));
      const bill = await settle();
      expect(bill).toMatchObject({
        status: "settled",
        balanceDue: 0,
        settledAt: harness.clock.now(),
      });

      const [row] = await harness.db.select().from(schema.bill);
      expect(row).toMatchObject({
        status: "settled",
        base: 32_408,
        tax: 2_592,
        discountTotal: 0,
        total: BILLING_TEST_TOTAL,
        settledByMemberId: scenario.seed.staff.cashierA.memberId,
      });
      const [session] = await harness.db
        .select()
        .from(schema.tableSession)
        .where(eq(schema.tableSession.id, sessionId));
      expect(session).toMatchObject({ status: "settled", settledAt: harness.clock.now() });
      await scenario.openSession({ lines: [] });
    });

    test("settling twice returns the settled Bill", async () => {
      await pay("cash", BILLING_TEST_TOTAL);
      await settle();
      expect((await settle()).status).toBe("settled");
    });

    test("the tip can change after settling without altering the Bill totals", async () => {
      await pay("cash", BILLING_TEST_TOTAL);
      await settle();
      const before = (await harness.db.select().from(schema.bill))[0]!;
      const raised = await call(
        restaurantRouter.billing.setTip,
        { tableSessionId: sessionId, amount: 2_000 },
        { context: await scenario.as("cashierA") },
      );
      expect(raised).toMatchObject({
        status: "settled",
        total: BILLING_TEST_TOTAL,
        balanceDue: 2_000,
      });
      const after = (await harness.db.select().from(schema.bill))[0]!;
      expect([after.base, after.tax, after.total]).toEqual([before.base, before.tax, before.total]);

      expect((await pay("qr_transfer", 2_000)).bill.balanceDue).toBe(0);
    });
  });

  describe("reopening", () => {
    beforeEach(async () => {
      await pay("cash", BILLING_TEST_TOTAL);
      await settle();
    });

    test("needs an Override: without one it is refused, with a wrong one the Bill stays settled", async () => {
      expect(await scenario.codeOf(reopen(undefined as unknown as string))).toBe("BAD_REQUEST");
      const wrong = await scenario.mintOverride("reopen_bill", "another-target");
      expect(await scenario.codeOf(reopen(wrong))).toBe("FORBIDDEN");
      expect((await getBill()).status).toBe("settled");
    });

    test("with an Override the Bill is reopened, the session returns to bill requested and it is audited", async () => {
      const overrideId = await scenario.mintOverride("reopen_bill", sessionId);
      const bill = await reopen(overrideId, "cashierA", { reason: "cobro mal digitado" });
      expect(bill).toMatchObject({ status: "reopened", settledAt: null });

      const [session] = await harness.db
        .select()
        .from(schema.tableSession)
        .where(eq(schema.tableSession.id, sessionId));
      expect(session).toMatchObject({ status: "bill_requested", settledAt: null });
      const [row] = await harness.db.select().from(schema.bill);
      expect(row).toMatchObject({
        status: "reopened",
        total: null,
        reopenedByMemberId: scenario.seed.staff.cashierA.memberId,
      });

      const event = harness.auditLogger.events.find((e) => e.action === "bill.reopened");
      expect(event).toMatchObject({
        targetId: row!.id,
        actorUserId: scenario.seed.staff.cashierA.userId,
      });
      expect(event!.metadata).toMatchObject({
        tableSessionId: sessionId,
        overrideId,
        approverMemberId: scenario.seed.staff.admin.memberId,
        reason: "cobro mal digitado",
      });
    });

    test("the Override is single use", async () => {
      const overrideId = await scenario.mintOverride("reopen_bill", sessionId);
      await reopen(overrideId);
      await settle();
      expect(await scenario.codeOf(reopen(overrideId))).toBe("FORBIDDEN");
    });

    test("a reopened Bill with nothing more due settles again", async () => {
      await reopen(await scenario.mintOverride("reopen_bill", sessionId));
      expect((await settle()).status).toBe("settled");
    });

    test("is refused, without spending the Override, while the Table has a new session", async () => {
      await scenario.openSession({ lines: [] });
      const overrideId = await scenario.mintOverride("reopen_bill", sessionId);
      expect(await scenario.codeOf(reopen(overrideId))).toBe("CONFLICT");
      const [spent] = await harness.db
        .select()
        .from(schema.override)
        .where(eq(schema.override.id, overrideId));
      expect(spent!.usedAt).toBeNull();
    });

    test("a Bill that is not settled cannot be reopened", async () => {
      const other = await scenario.openSession({ tableId: scenario.service.tables.t2 });
      const overrideId = await scenario.mintOverride("reopen_bill", other);
      const code = await scenario.codeOf(
        call(
          restaurantRouter.billing.reopen,
          { tableSessionId: other, overrideId },
          { context: await scenario.as("cashierA") },
        ),
      );
      expect(code).toBe("CONFLICT");
    });
  });
});
