import { formatCop } from "@base-template/ui/lib/format-cop";
import { describe, expect, test } from "bun:test";

import {
  closeDifferences,
  differenceCopy,
  parseCounted,
  parseOpeningAmount,
  toTakingRows,
} from "./shift-form";

const expected = { cash: 150_000, card: 80_000, qr_transfer: 30_000, total: 260_000 };

describe("parseOpeningAmount", () => {
  test("accepts zero and whole pesos", () => {
    expect(parseOpeningAmount("0")).toEqual({ ok: true, amount: 0 });
    expect(parseOpeningAmount("$ 100.000")).toEqual({ ok: true, amount: 100_000 });
  });

  test("a blank or decimal amount is refused", () => {
    expect(parseOpeningAmount(" ").ok).toBe(false);
    expect(parseOpeningAmount("10,5").ok).toBe(false);
  });
});

describe("parseCounted", () => {
  test("reads the counted amount of every tender, zero included", () => {
    expect(parseCounted({ cash: "150.000", card: "80000", qr_transfer: "0" })).toEqual({
      ok: true,
      counted: { cash: 150_000, card: 80_000, qr_transfer: 0 },
    });
  });

  test("names each tender left blank or wrong", () => {
    const result = parseCounted({ cash: "", card: "80000", qr_transfer: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["cash", "qr_transfer"]);
    }
  });
});

describe("closeDifferences", () => {
  test("a count that matches every tender needs no Override", () => {
    const result = closeDifferences(expected, { cash: 150_000, card: 80_000, qr_transfer: 30_000 });
    expect(result.needsOverride).toBe(false);
    expect(result.total).toBe(0);
    expect(result.rows.map((row) => row.difference)).toEqual([0, 0, 0]);
  });

  test("any tender off its expected amount needs an Override, even when the total matches", () => {
    const result = closeDifferences(expected, { cash: 140_000, card: 90_000, qr_transfer: 30_000 });
    expect(result.total).toBe(0);
    expect(result.needsOverride).toBe(true);
    expect(result.rows.find((row) => row.tender === "cash")).toEqual({
      tender: "cash",
      expected: 150_000,
      counted: 140_000,
      difference: -10_000,
    });
  });

  test("the total difference is counted minus expected", () => {
    expect(
      closeDifferences(expected, { cash: 100_000, card: 80_000, qr_transfer: 30_000 }).total,
    ).toBe(-50_000);
  });
});

describe("differenceCopy", () => {
  test("says whether the tender is short, over or right", () => {
    expect(differenceCopy(0)).toBe("Cuadra");
    expect(differenceCopy(-10_000)).toBe(`Faltan ${formatCop(10_000)}`);
    expect(differenceCopy(2_500)).toBe(`Sobran ${formatCop(2_500)}`);
  });
});

describe("toTakingRows", () => {
  const payment = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    tender: "card" as const,
    amount: 30_000,
    reference: "0045",
    recordedAt: new Date("2026-10-03T23:00:00Z"),
    clientRecordedAt: new Date("2026-10-03T18:00:00Z"),
    ...over,
  });

  test("lists the offline takings by their original sale time", () => {
    const rows = toTakingRows([
      payment("b", { clientRecordedAt: new Date("2026-10-03T19:00:00Z") }),
      payment("a"),
    ]);
    expect(rows.map((row) => row.id)).toEqual(["a", "b"]);
    expect(rows[0]).toEqual({
      id: "a",
      tender: "card",
      amount: 30_000,
      reference: "0045",
      saleTime: "2026-10-03T18:00:00.000Z",
    });
  });

  test("falls back to the time the server recorded it", () => {
    const [row] = toTakingRows([payment("a", { clientRecordedAt: null, reference: null })]);
    expect(row?.saleTime).toBe("2026-10-03T23:00:00.000Z");
    expect(row?.reference).toBeNull();
  });
});
