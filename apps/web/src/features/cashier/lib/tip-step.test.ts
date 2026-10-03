import { describe, expect, test } from "bun:test";

import { MAX_TIP, parseTip, suggestedTipOption } from "./tip-step";

describe("parseTip", () => {
  test("accepts zero and whole pesos, with thousands dots", () => {
    expect(parseTip("0")).toEqual({ ok: true, amount: 0 });
    expect(parseTip("$ 6.200")).toEqual({ ok: true, amount: 6_200 });
  });

  test("a blank field is not a tip", () => {
    expect(parseTip("  ").ok).toBe(false);
  });

  test("refuses decimals and amounts above the limit", () => {
    expect(parseTip("12,5").ok).toBe(false);
    expect(parseTip(String(MAX_TIP + 1)).ok).toBe(false);
    expect(parseTip(String(MAX_TIP)).ok).toBe(true);
  });
});

describe("suggestedTipOption", () => {
  test("offers the Location's suggested percent with its amount", () => {
    expect(suggestedTipOption({ percent: 10, amount: 6_200 })).toEqual({
      label: "Sugerida 10%",
      amount: 6_200,
    });
  });

  test("offers nothing when the percent or the amount is zero", () => {
    expect(suggestedTipOption({ percent: 0, amount: 0 })).toBeNull();
    expect(suggestedTipOption({ percent: 10, amount: 0 })).toBeNull();
  });
});
