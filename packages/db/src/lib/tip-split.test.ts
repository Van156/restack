import { describe, expect, test } from "bun:test";

import { splitTips } from "./tip-split";

describe("splitTips", () => {
  test("equal split gives the remainder pesos to the first beneficiaries", () => {
    expect(splitTips(10_000, [{}, {}, {}])).toEqual([3_334, 3_333, 3_333]);
    expect(splitTips(10_002, [{}, {}, {}, {}])).toEqual([2_501, 2_501, 2_500, 2_500]);
  });

  test("equal split of an exact multiple has no remainder", () => {
    expect(splitTips(9_000, [{}, {}, {}])).toEqual([3_000, 3_000, 3_000]);
  });

  test("percentage split floors each share and hands leftover pesos to the largest fractions", () => {
    // 1 001 * 33% = 330.33, 1 001 * 33% = 330.33, 1 001 * 34% = 340.34 -> floors 330/330/340, 1 left.
    expect(
      splitTips(1_001, [{ sharePercent: 33 }, { sharePercent: 33 }, { sharePercent: 34 }]),
    ).toEqual([330, 330, 341]);
  });

  test("percentage ties on the fraction go to the earlier beneficiary", () => {
    expect(splitTips(101, [{ sharePercent: 50 }, { sharePercent: 50 }])).toEqual([51, 50]);
  });

  test("the shares always add up to the total", () => {
    for (const total of [0, 1, 7, 999, 12_345, 100_001]) {
      const equal = splitTips(total, [{}, {}, {}, {}, {}, {}, {}]);
      expect(equal.reduce((sum, share) => sum + share, 0)).toBe(total);
      const percent = splitTips(total, [
        { sharePercent: 15 },
        { sharePercent: 25 },
        { sharePercent: 60 },
      ]);
      expect(percent.reduce((sum, share) => sum + share, 0)).toBe(total);
    }
  });

  test("a zero total gives zero shares", () => {
    expect(splitTips(0, [{}, {}])).toEqual([0, 0]);
  });

  test("rejects no beneficiaries, a negative or fractional total", () => {
    expect(() => splitTips(100, [])).toThrow();
    expect(() => splitTips(-1, [{}])).toThrow();
    expect(() => splitTips(1.5, [{}])).toThrow();
  });

  test("rejects mixed modes and percentages that do not sum to 100", () => {
    expect(() => splitTips(100, [{ sharePercent: 50 }, {}])).toThrow();
    expect(() => splitTips(100, [{ sharePercent: 50 }, { sharePercent: 40 }])).toThrow();
    expect(() => splitTips(100, [{ sharePercent: 0 }, { sharePercent: 100 }])).toThrow();
  });
});
