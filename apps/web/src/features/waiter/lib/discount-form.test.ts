import { describe, expect, test } from "bun:test";

import { validateDiscount } from "./discount-form";

describe("validateDiscount", () => {
  test("accepts a whole amount in pesos", () => {
    expect(validateDiscount({ kind: "amount", value: "5000" })).toEqual({
      ok: true,
      value: { kind: "amount", value: 5000 },
    });
  });

  test("accepts a percent from 1 to 100", () => {
    expect(validateDiscount({ kind: "percent", value: "100" }).ok).toBe(true);
    expect(validateDiscount({ kind: "percent", value: "101" })).toEqual({
      ok: false,
      error: "El porcentaje va de 1 a 100.",
    });
  });

  test("refuses empty, zero, decimal and negative values", () => {
    for (const value of ["", "0", "2.5", "-3", "abc"]) {
      expect(validateDiscount({ kind: "amount", value }).ok).toBe(false);
    }
  });
});
