import { describe, expect, test } from "bun:test";

import {
  summarizeByItem,
  summarizeByStaff,
  summarizeMargin,
  summarizeTenders,
} from "./sales-report";
import type { ReportBill, ReportLine } from "./sales-report";

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

function line(overrides: Partial<ReportLine> & Pick<ReportLine, "itemName">): ReportLine {
  return { menuItemId: overrides.itemName, quantity: 1, revenue: 0, unitCost: null, ...overrides };
}

describe("summarizeMargin", () => {
  test("margin is revenue minus cost over costed lines only", () => {
    expect(
      summarizeMargin([
        line({ itemName: "a", quantity: 2, revenue: 20_000, unitCost: 3_000 }),
        line({ itemName: "b", revenue: 6_000, unitCost: 2_500 }),
      ]),
    ).toEqual({
      revenue: 26_000,
      costedRevenue: 26_000,
      uncostedRevenue: 0,
      cost: 8_500,
      margin: 17_500,
      marginIncomplete: false,
    });
  });

  test("lines without a cost are flagged, not counted as zero cost", () => {
    expect(
      summarizeMargin([
        line({ itemName: "a", revenue: 10_000, unitCost: 4_000 }),
        line({ itemName: "b", revenue: 9_000, unitCost: null }),
      ]),
    ).toEqual({
      revenue: 19_000,
      costedRevenue: 10_000,
      uncostedRevenue: 9_000,
      cost: 4_000,
      margin: 6_000,
      marginIncomplete: true,
    });
  });

  test("no costed line leaves the margin unknown instead of the full revenue", () => {
    expect(summarizeMargin([line({ itemName: "b", revenue: 9_000 })])).toMatchObject({
      margin: null,
      marginIncomplete: true,
    });
  });

  test("a zero cost is a cost: the whole revenue is margin", () => {
    expect(summarizeMargin([line({ itemName: "a", revenue: 5_000, unitCost: 0 })])).toMatchObject({
      margin: 5_000,
      marginIncomplete: false,
    });
  });

  test("an empty set has no margin and nothing incomplete", () => {
    expect(summarizeMargin([])).toEqual({
      revenue: 0,
      costedRevenue: 0,
      uncostedRevenue: 0,
      cost: 0,
      margin: null,
      marginIncomplete: false,
    });
  });
});

describe("summarizeByItem", () => {
  test("groups lines by Menu item across Bills, best revenue first, with cost and margin", () => {
    const items = summarizeByItem([
      bill({
        id: "b1",
        lines: [
          line({
            menuItemId: "beer",
            itemName: "Cerveza",
            quantity: 2,
            revenue: 12_000,
            unitCost: 2_000,
          }),
          line({ menuItemId: "fries", itemName: "Papas", revenue: 9_000, unitCost: null }),
        ],
      }),
      bill({
        id: "b2",
        lines: [line({ menuItemId: "beer", itemName: "Cerveza", revenue: 5_000, unitCost: 2_000 })],
      }),
    ]);
    expect(items).toEqual([
      {
        menuItemId: "beer",
        itemName: "Cerveza",
        quantity: 3,
        revenue: 17_000,
        cost: 6_000,
        margin: 11_000,
        costMissing: false,
      },
      {
        menuItemId: "fries",
        itemName: "Papas",
        quantity: 1,
        revenue: 9_000,
        cost: null,
        margin: null,
        costMissing: true,
      },
    ]);
  });

  test("a deleted Menu item keeps its recorded name, is flagged and groups by that name", () => {
    const items = summarizeByItem([
      bill({
        id: "b1",
        lines: [
          line({ menuItemId: null, itemName: "Postre", revenue: 4_000 }),
          line({ menuItemId: null, itemName: "Postre", revenue: 4_000 }),
          line({ menuItemId: null, itemName: "Café", revenue: 3_000 }),
        ],
      }),
    ]);
    expect(items.map((item) => [item.itemName, item.quantity, item.costMissing])).toEqual([
      ["Postre", 2, true],
      ["Café", 1, true],
    ]);
  });

  test("ties on revenue sort by name", () => {
    const items = summarizeByItem([
      bill({
        id: "b1",
        lines: [
          line({ menuItemId: "z", itemName: "Zumo", revenue: 5_000, unitCost: 1 }),
          line({ menuItemId: "a", itemName: "Agua", revenue: 5_000, unitCost: 1 }),
        ],
      }),
    ]);
    expect(items.map((item) => item.itemName)).toEqual(["Agua", "Zumo"]);
  });
});

describe("summarizeByStaff", () => {
  test("groups Bills by who settled them with sales, tips and margin", () => {
    const staff = summarizeByStaff([
      bill({
        id: "b1",
        settledByMemberId: "m1",
        total: 20_000,
        tip: 2_000,
        lines: [line({ itemName: "a", revenue: 20_000, unitCost: 5_000 })],
      }),
      bill({
        id: "b2",
        settledByMemberId: "m2",
        total: 40_000,
        lines: [line({ itemName: "b", revenue: 40_000, unitCost: null })],
      }),
      bill({
        id: "b3",
        settledByMemberId: "m1",
        total: 10_000,
        lines: [line({ itemName: "a", revenue: 10_000, unitCost: 5_000 })],
      }),
    ]);
    expect(staff).toEqual([
      {
        memberId: "m2",
        billCount: 1,
        salesTotal: 40_000,
        tipTotal: 0,
        margin: {
          revenue: 40_000,
          costedRevenue: 0,
          uncostedRevenue: 40_000,
          cost: 0,
          margin: null,
          marginIncomplete: true,
        },
      },
      {
        memberId: "m1",
        billCount: 2,
        salesTotal: 30_000,
        tipTotal: 2_000,
        margin: {
          revenue: 30_000,
          costedRevenue: 30_000,
          uncostedRevenue: 0,
          cost: 10_000,
          margin: 20_000,
          marginIncomplete: false,
        },
      },
    ]);
  });

  test("a Bill without a recorded member groups under null", () => {
    const staff = summarizeByStaff([bill({ id: "b1", settledByMemberId: null, total: 1_000 })]);
    expect(staff.map((row) => row.memberId)).toEqual([null]);
  });
});
