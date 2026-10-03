import { describe, expect, test } from "bun:test";

import { summarizeTenders } from "./sales-report";
import type { ReportBill } from "./sales-report";

function bill(overrides: Partial<ReportBill> & Pick<ReportBill, "id">): ReportBill {
  return {
    locationId: "loc-a",
    settledByMemberId: null,
    total: 0,
    tip: 0,
    payments: [],
    lines: [],
    ...overrides,
  };
}

describe("summarizeTenders", () => {
  test("an empty day is all zeros", () => {
    expect(summarizeTenders([])).toEqual({
      billCount: 0,
      salesTotal: 0,
      tipTotal: 0,
      collectedTotal: 0,
      tenders: {
        cash: { count: 0, amount: 0 },
        card: { count: 0, amount: 0 },
        qr_transfer: { count: 0, amount: 0 },
      },
    });
  });

  test("sums sales, tips and payments per tender, keeping the tip out of sales", () => {
    const result = summarizeTenders([
      bill({
        id: "b1",
        total: 35_000,
        tip: 3_500,
        payments: [
          { tender: "cash", amount: 20_000 },
          { tender: "card", amount: 18_500 },
        ],
      }),
      bill({
        id: "b2",
        total: 10_000,
        payments: [{ tender: "qr_transfer", amount: 10_000 }],
      }),
    ]);
    expect(result).toEqual({
      billCount: 2,
      salesTotal: 45_000,
      tipTotal: 3_500,
      collectedTotal: 48_500,
      tenders: {
        cash: { count: 1, amount: 20_000 },
        card: { count: 1, amount: 18_500 },
        qr_transfer: { count: 1, amount: 10_000 },
      },
    });
  });

  test("split payments on one Bill count once per payment", () => {
    const result = summarizeTenders([
      bill({
        id: "b1",
        total: 30_000,
        payments: [
          { tender: "cash", amount: 10_000 },
          { tender: "cash", amount: 20_000 },
        ],
      }),
    ]);
    expect(result.tenders.cash).toEqual({ count: 2, amount: 30_000 });
    expect(result.billCount).toBe(1);
  });
});
