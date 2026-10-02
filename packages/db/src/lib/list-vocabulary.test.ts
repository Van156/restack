import { describe, expect, test } from "bun:test";

import {
  FILTER_OPERATORS,
  FILTER_VARIANTS,
  getServerOperators,
  JOIN_OPERATORS,
  MAX_FILTER_VALUE_LENGTH,
  MAX_FILTERS,
  MAX_SORT_ITEMS,
  OPERATORS_BY_VARIANT,
  SERVER_OPERATORS,
} from "./list-vocabulary";

describe("list vocabulary", () => {
  test("every variant has operators drawn from the operator vocabulary", () => {
    for (const variant of FILTER_VARIANTS) {
      expect(OPERATORS_BY_VARIANT[variant].length).toBeGreaterThan(0);
      for (const operator of OPERATORS_BY_VARIANT[variant]) {
        expect(FILTER_OPERATORS).toContain(operator);
      }
    }
  });

  test("the server rejects isRelativeToToday for every variant", () => {
    expect(OPERATORS_BY_VARIANT.date).toContain("isRelativeToToday");
    for (const variant of FILTER_VARIANTS) {
      expect(getServerOperators(variant)).not.toContain("isRelativeToToday");
    }
    expect(getServerOperators("date")).toContain("isBetween");
  });

  test("server operators are the vocabulary minus isRelativeToToday", () => {
    expect(
      FILTER_OPERATORS.filter((operator) => !SERVER_OPERATORS.includes(operator as never)),
    ).toEqual(["isRelativeToToday"]);
  });

  test("server operators keep the vocabulary order", () => {
    expect(SERVER_OPERATORS).toEqual(
      FILTER_OPERATORS.filter((operator) => operator !== "isRelativeToToday"),
    );
  });

  test("constants", () => {
    expect(JOIN_OPERATORS).toEqual(["and", "or"]);
    expect(MAX_SORT_ITEMS).toBe(3);
    expect(MAX_FILTERS).toBe(10);
    expect(MAX_FILTER_VALUE_LENGTH).toBe(256);
  });
});
