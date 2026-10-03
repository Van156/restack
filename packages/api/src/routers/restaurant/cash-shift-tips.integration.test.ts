import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { BILLING_TEST_TOTAL, seedBillingScenario } from "../../testing/billing-fixtures";
import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "restaurant tips");

describe.skipIf(!reachable)("restaurant cash shift: tip beneficiaries and distribution", () => {
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
  const member = (key: keyof typeof scenario.seed.staff) => scenario.seed.staff[key].memberId;

  /** A paid and settled sale in the open shift with the given tip, paid in cash. */
  async function sale(tip: number) {
    const tableSessionId = await scenario.openSession();
    const context = await scenario.as("cashierA");
    await call(restaurantRouter.billing.setTip, { tableSessionId, amount: tip }, { context });
    await call(
      restaurantRouter.billing.recordPayment,
      {
        tableSessionId,
        tender: "cash",
        amount: BILLING_TEST_TOTAL + tip,
        idempotencyKey: scenario.nextKey(),
      },
      { context },
    );
    await call(restaurantRouter.billing.settle, { tableSessionId }, { context });
  }

  /** Opens a shift, makes one sale with `tip` and closes it with the exact count. */
  async function closedShiftWithTip(tip: number) {
    const shift = await scenario.openShift(50_000);
    await sale(tip);
    await call(
      restaurantRouter.cashShift.close,
      {
        cashShiftId: shift.id,
        counted: { cash: 50_000 + BILLING_TEST_TOTAL + tip, card: 0, qr_transfer: 0 },
      },
      { context: await scenario.as("cashierA") },
    );
    return shift.id;
  }

  const setBeneficiaries = async (
    cashShiftId: string,
    beneficiaries: { memberId?: string; displayName?: string; sharePercent?: number }[],
    key: StaffKey = "admin",
  ) =>
    call(
      restaurantRouter.cashShift.setTipBeneficiaries,
      { cashShiftId, beneficiaries },
      { context: await scenario.as(key) },
    );

  const distribute = async (cashShiftId: string, key: StaffKey = "cashierA") =>
    call(
      restaurantRouter.cashShift.distributeTips,
      { cashShiftId },
      { context: await scenario.as(key) },
    );

  describe("candidates and beneficiaries", () => {
    test("candidates are the Location's Staff without the Owner and Administrators", async () => {
      const rows = await call(
        restaurantRouter.cashShift.tipCandidates,
        { locationId: scenario.seed.locations.a },
        { context: await scenario.as("cashierA") },
      );
      const ids = rows.map((row) => row.memberId).sort();
      expect(ids).toEqual([member("cashierA"), member("waiterA")].sort());
      expect(rows.find((row) => row.memberId === member("waiterA"))?.displayName).toBe("waiter-a");
    });

    test("configures members and people added by name, replacing the previous list", async () => {
      const shift = await scenario.openShift();
      await setBeneficiaries(shift.id, [{ memberId: member("waiterA") }, { displayName: "Juan" }]);
      const rows = await setBeneficiaries(shift.id, [
        { displayName: "Juan" },
        { memberId: member("cashierA") },
        { displayName: "Marta" },
      ]);
      expect(rows.map((row) => [row.displayName, row.memberId, row.sharePercent])).toEqual([
        ["Juan", null, null],
        ["cashier-a", member("cashierA"), null],
        ["Marta", null, null],
      ]);
      const listed = await call(
        restaurantRouter.cashShift.tipBeneficiaries,
        { cashShiftId: shift.id },
        { context: await scenario.as("cashierA") },
      );
      expect(listed.map((row) => row.displayName)).toEqual(["Juan", "cashier-a", "Marta"]);
    });

    test("the Owner and Administrators can never be beneficiaries", async () => {
      const shift = await scenario.openShift();
      expect(
        await scenario.codeOf(setBeneficiaries(shift.id, [{ memberId: member("owner") }])),
      ).toBe("BAD_REQUEST");
      expect(
        await scenario.codeOf(setBeneficiaries(shift.id, [{ memberId: member("admin") }])),
      ).toBe("BAD_REQUEST");
    });

    test("a member must be assigned to the shift's Location and listed once", async () => {
      const shift = await scenario.openShift();
      expect(
        await scenario.codeOf(setBeneficiaries(shift.id, [{ memberId: member("waiterB") }])),
      ).toBe("BAD_REQUEST");
      expect(
        await scenario.codeOf(
          setBeneficiaries(shift.id, [
            { memberId: member("waiterA") },
            { memberId: member("waiterA") },
          ]),
        ),
      ).toBe("BAD_REQUEST");
    });

    test("each entry is a member or a name, never both or neither", async () => {
      const shift = await scenario.openShift();
      expect(
        await scenario.codeOf(
          setBeneficiaries(shift.id, [{ memberId: member("waiterA"), displayName: "X" }]),
        ),
      ).toBe("BAD_REQUEST");
      expect(await scenario.codeOf(setBeneficiaries(shift.id, [{}]))).toBe("BAD_REQUEST");
    });

    test("percents are all or none and add up to 100", async () => {
      const shift = await scenario.openShift();
      const bad = [
        [{ displayName: "A", sharePercent: 60 }, { displayName: "B" }],
        [
          { displayName: "A", sharePercent: 60 },
          { displayName: "B", sharePercent: 30 },
        ],
      ];
      for (const entries of bad) {
        expect(await scenario.codeOf(setBeneficiaries(shift.id, entries))).toBe("BAD_REQUEST");
      }
      const ok = await setBeneficiaries(shift.id, [
        { displayName: "A", sharePercent: 60 },
        { displayName: "B", sharePercent: 40 },
      ]);
      expect(ok.map((row) => row.sharePercent)).toEqual([60, 40]);
    });

    test("only Owner and Administrators configure; the Cashier and Waiter may not", async () => {
      const shift = await scenario.openShift();
      expect(
        await scenario.codeOf(setBeneficiaries(shift.id, [{ displayName: "A" }], "cashierA")),
      ).toBe("FORBIDDEN");
      expect(
        await scenario.codeOf(setBeneficiaries(shift.id, [{ displayName: "A" }], "waiterA")),
      ).toBe("FORBIDDEN");
      expect((await setBeneficiaries(shift.id, [{ displayName: "A" }], "owner")).length).toBe(1);
    });
  });

  describe("distribution", () => {
    test("splits the shift's tips equally, remainder pesos to the first beneficiaries, and audits it", async () => {
      const shiftId = await closedShiftWithTip(10_000);
      await setBeneficiaries(shiftId, [
        { memberId: member("waiterA") },
        { displayName: "Juan" },
        { displayName: "Marta" },
      ]);
      const rows = await distribute(shiftId);
      expect(rows.map((row) => [row.displayName, row.amount])).toEqual([
        ["waiter-a", 3_334],
        ["Juan", 3_333],
        ["Marta", 3_333],
      ]);
      const events = (await harness.db.select().from(schema.auditLog)).filter(
        (row) => row.action === "tip.distributed",
      );
      expect(events).toHaveLength(1);
      expect(events[0]?.metadata).toMatchObject({ total: 10_000 });
    });

    test("splits by the agreed percentages", async () => {
      const shiftId = await closedShiftWithTip(10_000);
      await setBeneficiaries(shiftId, [
        { displayName: "A", sharePercent: 50 },
        { displayName: "B", sharePercent: 30 },
        { displayName: "C", sharePercent: 20 },
      ]);
      expect((await distribute(shiftId)).map((row) => row.amount)).toEqual([5_000, 3_000, 2_000]);
    });

    test("is idempotent: a second call returns the same rows and audits once", async () => {
      const shiftId = await closedShiftWithTip(4_000);
      await setBeneficiaries(shiftId, [{ displayName: "A" }, { displayName: "B" }]);
      const first = await distribute(shiftId);
      const second = await distribute(shiftId);
      expect(second.map((row) => row.id)).toEqual(first.map((row) => row.id));
      expect(
        (await harness.db.select().from(schema.auditLog)).filter(
          (row) => row.action === "tip.distributed",
        ),
      ).toHaveLength(1);
    });

    test("a shift without tips distributes zero amounts", async () => {
      const shiftId = await closedShiftWithTip(0);
      await setBeneficiaries(shiftId, [{ displayName: "A" }, { displayName: "B" }]);
      expect((await distribute(shiftId)).map((row) => row.amount)).toEqual([0, 0]);
    });

    test("needs a closed shift and configured beneficiaries", async () => {
      const shift = await scenario.openShift();
      await setBeneficiaries(shift.id, [{ displayName: "A" }]);
      expect(await scenario.codeOf(distribute(shift.id))).toBe("CONFLICT");
      await call(
        restaurantRouter.cashShift.close,
        { cashShiftId: shift.id, counted: { cash: 50_000, card: 0, qr_transfer: 0 } },
        { context: await scenario.as("cashierA") },
      );
      await harness.db.delete(schema.tipBeneficiary);
      expect(await scenario.codeOf(distribute(shift.id))).toBe("PRECONDITION_FAILED");
    });

    test("beneficiaries are frozen once distributed, and the Waiter may not distribute", async () => {
      const shiftId = await closedShiftWithTip(2_000);
      await setBeneficiaries(shiftId, [{ displayName: "A" }]);
      expect(await scenario.codeOf(distribute(shiftId, "waiterA"))).toBe("FORBIDDEN");
      await distribute(shiftId);
      expect(await scenario.codeOf(setBeneficiaries(shiftId, [{ displayName: "B" }]))).toBe(
        "CONFLICT",
      );
    });
  });

  describe("report", () => {
    const report = async (input: Record<string, unknown>, key: StaffKey = "cashierA") =>
      call(
        restaurantRouter.cashShift.tipDistributionReport,
        { locationId: scenario.seed.locations.a, ...input } as never,
        { context: await scenario.as(key) },
      );

    test("reports one shift per person", async () => {
      const shiftId = await closedShiftWithTip(10_000);
      await setBeneficiaries(shiftId, [
        { displayName: "A", sharePercent: 70 },
        { displayName: "B", sharePercent: 30 },
      ]);
      await distribute(shiftId);
      const result = await report({ cashShiftId: shiftId });
      expect(result.shifts).toHaveLength(1);
      expect(result.shifts[0]).toMatchObject({ cashShiftId: shiftId, tipTotal: 10_000 });
      expect(result.people.map((person) => [person.displayName, person.amount])).toEqual([
        ["A", 7_000],
        ["B", 3_000],
      ]);
    });

    test("a period sums each person across the shifts closed in those Bogota days", async () => {
      const first = await closedShiftWithTip(10_000);
      await setBeneficiaries(first, [{ memberId: member("waiterA") }, { displayName: "Juan" }]);
      await distribute(first);
      const second = await closedShiftWithTip(6_000);
      await setBeneficiaries(second, [{ memberId: member("waiterA") }]);
      await distribute(second);

      const today = await report({ from: "2026-10-02", to: "2026-10-02" });
      expect(today.shifts).toHaveLength(2);
      expect(today.people.map((person) => [person.displayName, person.amount])).toEqual([
        ["waiter-a", 11_000],
        ["Juan", 5_000],
      ]);

      const later = await report({ from: "2026-10-03", to: "2026-10-03" });
      expect(later.shifts).toEqual([]);
      expect(later.people).toEqual([]);
    });

    test("needs a shift or a period, is Location-scoped and denied to the Waiter", async () => {
      expect(await scenario.codeOf(report({}))).toBe("BAD_REQUEST");
      expect(
        await scenario.codeOf(report({ from: "2026-10-02", to: "2026-10-02" }, "waiterA")),
      ).toBe("FORBIDDEN");
      expect(
        await scenario.codeOf(
          call(
            restaurantRouter.cashShift.tipDistributionReport,
            { locationId: scenario.seed.locations.b, from: "2026-10-02", to: "2026-10-02" },
            { context: await scenario.as("cashierA") },
          ),
        ),
      ).toBe("FORBIDDEN");
    });
  });
});
