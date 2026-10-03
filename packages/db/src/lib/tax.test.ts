import { describe, expect, test } from "bun:test";

import { deriveTax, TAX_RATE_PERCENT } from "./tax";

describe("deriveTax (inclusive prices, round half up once per line)", () => {
  test("exposes the statutory rates", () => {
    expect(TAX_RATE_PERCENT).toEqual({ impoconsumo: 8, iva19: 19 });
  });

  test("impoconsumo 8%: 10800 splits exactly into 10000 + 800", () => {
    expect(deriveTax(10_800, "impoconsumo")).toEqual({ base: 10_000, tax: 800, total: 10_800 });
  });

  test("IVA 19%: 11900 splits exactly into 10000 + 1900", () => {
    expect(deriveTax(11_900, "iva19")).toEqual({ base: 10_000, tax: 1_900, total: 11_900 });
  });

  test("rounds the base to the whole peso", () => {
    // 25000 / 1.08 = 23148.148...
    expect(deriveTax(25_000, "impoconsumo")).toEqual({ base: 23_148, tax: 1_852, total: 25_000 });
    // 25000 / 1.19 = 21008.403...
    expect(deriveTax(25_000, "iva19")).toEqual({ base: 21_008, tax: 3_992, total: 25_000 });
  });

  test("rounds up when the fractional base is at or above one half", () => {
    // 5 / 1.08 = 4.6296 -> 5 ; 4 / 1.08 = 3.7037 -> 4 ; 2 / 1.08 = 1.85 -> 2
    expect(deriveTax(5, "impoconsumo")).toEqual({ base: 5, tax: 0, total: 5 });
    // 14 / 1.08 = 12.96 -> 13 ; 13 / 1.08 = 12.037 -> 12
    expect(deriveTax(14, "impoconsumo")).toEqual({ base: 13, tax: 1, total: 14 });
    expect(deriveTax(13, "impoconsumo")).toEqual({ base: 12, tax: 1, total: 13 });
    // 1 / 1.19 = 0.84 -> 1 ; 0 stays 0
    expect(deriveTax(1, "iva19")).toEqual({ base: 1, tax: 0, total: 1 });
    expect(deriveTax(0, "iva19")).toEqual({ base: 0, tax: 0, total: 0 });
  });

  test("base + tax always equals the total, for every price up to 200000", () => {
    for (let total = 0; total <= 200_000; total += 1) {
      for (const taxClass of ["impoconsumo", "iva19"] as const) {
        const result = deriveTax(total, taxClass);
        expect(result.base + result.tax).toBe(total);
        const exact = total / (1 + TAX_RATE_PERCENT[taxClass] / 100);
        expect(Math.abs(result.base - exact)).toBeLessThanOrEqual(0.5 + 1e-6);
      }
    }
  });

  test("is exact for very large integers where floats drift", () => {
    expect(deriveTax(Number.MAX_SAFE_INTEGER, "impoconsumo").base).toBe(8_339_999_309_945_362);
  });

  test("rejects negative, fractional and non-finite amounts", () => {
    expect(() => deriveTax(-1, "impoconsumo")).toThrow(RangeError);
    expect(() => deriveTax(10.5, "impoconsumo")).toThrow(RangeError);
    expect(() => deriveTax(Number.NaN, "iva19")).toThrow(RangeError);
    expect(() => deriveTax(Number.POSITIVE_INFINITY, "iva19")).toThrow(RangeError);
  });
});
