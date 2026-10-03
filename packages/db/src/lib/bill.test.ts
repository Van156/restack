import { describe, expect, test } from "bun:test";

import { computeBill, suggestedTip } from "./bill";
import type { BillLineInput } from "./bill";

const line = (
  id: string,
  unitPrice: number,
  quantity = 1,
  taxClass: BillLineInput["taxClass"] = "impoconsumo",
): BillLineInput => ({
  id,
  unitPrice,
  quantity,
  taxClass,
  modifiers: [],
});

describe("computeBill without discounts", () => {
  test("totals are the sum of line totals and tax is derived once per line", () => {
    const bill = computeBill([line("a", 20_000), line("b", 6_000, 2)], []);
    expect(bill.subtotal).toBe(32_000);
    expect(bill.total).toBe(32_000);
    expect(bill.discountTotal).toBe(0);
    expect(bill.lines.map((entry) => [entry.base, entry.tax])).toEqual([
      [18_519, 1_481],
      [11_111, 889],
    ]);
    expect(bill.base).toBe(29_630);
    expect(bill.tax).toBe(2_370);
    expect(bill.base + bill.tax).toBe(bill.total);
  });

  test("modifier deltas are part of the line total", () => {
    const bill = computeBill(
      [
        {
          ...line("a", 20_000, 2),
          modifiers: [{ modifierId: "m", name: "Queso", priceDelta: 2_000 }],
        },
      ],
      [],
    );
    expect(bill.lines[0]!.total).toBe(44_000);
  });

  test("rounding is per line, not on the sum (three 1 000 COP lines)", () => {
    const bill = computeBill([line("a", 1_000), line("b", 1_000), line("c", 1_000)], []);
    expect(bill.lines.map((entry) => entry.tax)).toEqual([74, 74, 74]);
    expect(bill.tax).toBe(222);
    expect(bill.base).toBe(2_778);
  });

  test("tax groups by class and franchise lines use IVA 19%", () => {
    const bill = computeBill([line("a", 11_900, 1, "iva19"), line("b", 10_800)], []);
    expect(bill.taxByClass.iva19).toEqual({ base: 10_000, tax: 1_900 });
    expect(bill.taxByClass.impoconsumo).toEqual({ base: 10_000, tax: 800 });
  });

  test("an empty Bill is all zeros", () => {
    const bill = computeBill([], []);
    expect([bill.subtotal, bill.total, bill.base, bill.tax]).toEqual([0, 0, 0, 0]);
  });
});

describe("computeBill discounts", () => {
  test("an amount discount is spread across lines in proportion to their total", () => {
    const bill = computeBill(
      [line("a", 30_000), line("b", 10_000)],
      [{ kind: "amount", value: 4_000 }],
    );
    expect(bill.discountTotal).toBe(4_000);
    expect(bill.lines.map((entry) => entry.discount)).toEqual([3_000, 1_000]);
    expect(bill.total).toBe(36_000);
    expect(bill.lines.map((entry) => entry.total)).toEqual([27_000, 9_000]);
  });

  test("the tax base shrinks with the discount and tax is derived from each discounted line", () => {
    const bill = computeBill([line("a", 10_800)], [{ kind: "amount", value: 1_080 }]);
    expect(bill.lines[0]!.total).toBe(9_720);
    expect(bill.base).toBe(9_000);
    expect(bill.tax).toBe(720);
  });

  test("the remainder pesos go to the lines with the largest fractional share, earlier lines first on ties", () => {
    const bill = computeBill(
      [line("a", 1_000), line("b", 1_000), line("c", 1_000)],
      [{ kind: "amount", value: 100 }],
    );
    expect(bill.lines.map((entry) => entry.discount)).toEqual([34, 33, 33]);
    expect(bill.lines.reduce((sum, entry) => sum + entry.discount, 0)).toBe(100);
    expect(bill.total).toBe(2_900);
  });

  test("a percent discount rounds half up on the subtotal", () => {
    const bill = computeBill([line("a", 1_005)], [{ kind: "percent", value: 10 }]);
    expect(bill.discountTotal).toBe(101);
    expect(bill.total).toBe(904);
  });

  test("several discounts apply in order, each percent on what remains", () => {
    const bill = computeBill(
      [line("a", 10_000)],
      [
        { kind: "percent", value: 10 },
        { kind: "percent", value: 10 },
        { kind: "amount", value: 500 },
      ],
    );
    expect(bill.discountTotal).toBe(2_400);
    expect(bill.total).toBe(7_600);
  });

  test("discounts are capped at the Bill total", () => {
    const bill = computeBill(
      [line("a", 5_000), line("b", 3_000)],
      [{ kind: "amount", value: 50_000 }],
    );
    expect(bill.discountTotal).toBe(8_000);
    expect(bill.total).toBe(0);
    expect(bill.base + bill.tax).toBe(0);
  });

  test("a discount stack that exceeds the total never goes negative", () => {
    const bill = computeBill(
      [line("a", 1_000)],
      [
        { kind: "amount", value: 800 },
        { kind: "amount", value: 800 },
        { kind: "percent", value: 100 },
      ],
    );
    expect(bill.discountTotal).toBe(1_000);
    expect(bill.total).toBe(0);
  });

  test("a discount on an empty Bill is zero", () => {
    expect(computeBill([], [{ kind: "amount", value: 1_000 }]).discountTotal).toBe(0);
  });

  test("line totals plus line discounts always reconcile with the subtotal", () => {
    const lines = [line("a", 3_333, 3), line("b", 777, 7), line("c", 12_345)];
    const bill = computeBill(lines, [
      { kind: "percent", value: 15 },
      { kind: "amount", value: 999 },
    ]);
    const discounted = bill.lines.reduce((sum, entry) => sum + entry.total, 0);
    expect(discounted).toBe(bill.total);
    expect(bill.subtotal - bill.discountTotal).toBe(bill.total);
    expect(bill.base + bill.tax).toBe(bill.total);
  });
});

describe("suggestedTip", () => {
  test("is the percent of the Bill total rounded half up, outside the tax base", () => {
    expect(suggestedTip(32_000, 10)).toBe(3_200);
    expect(suggestedTip(1_005, 10)).toBe(101);
    expect(suggestedTip(32_000, 0)).toBe(0);
  });
});
