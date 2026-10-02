import { OPERATORS_BY_VARIANT } from "@base-template/api/lib/list-vocabulary";
import { describe, expect, test } from "bun:test";

import {
  dataTableConfig,
  getDefaultFilterOperator,
  getFilterOperators,
  isOperatorValidForVariant,
  operatorNeedsValue,
} from "./config";

describe("getFilterOperators", () => {
  test("returns operator values per variant", () => {
    const values = (variant: Parameters<typeof getFilterOperators>[0]) =>
      getFilterOperators(variant).map((operator) => operator.value);

    expect(values("text")).toEqual(["iLike", "notILike", "eq", "ne", "isEmpty", "isNotEmpty"]);
    expect(values("boolean")).toEqual(["eq", "ne"]);
    expect(values("multiSelect")).toEqual(["inArray", "notInArray", "isEmpty", "isNotEmpty"]);
    expect(values("number")).toContain("isBetween");
    expect(values("range")).toEqual(values("number"));
    expect(values("dateRange")).toEqual(values("date"));
    expect(values("date")).toContain("isRelativeToToday");
  });

  test("falls back to text operators for an unknown variant", () => {
    // @ts-expect-error deliberately invalid variant
    expect(getFilterOperators("nope")).toBe(dataTableConfig.textOperators);
  });

  test("falls back to text operators for prototype keys", () => {
    for (const key of ["toString", "__proto__", "constructor", "hasOwnProperty"]) {
      // @ts-expect-error deliberately invalid variant
      expect(getFilterOperators(key)).toBe(dataTableConfig.textOperators);
    }
  });
});

describe("getDefaultFilterOperator", () => {
  test("is the first operator of the variant", () => {
    expect(getDefaultFilterOperator("text")).toBe("iLike");
    expect(getDefaultFilterOperator("number")).toBe("eq");
    expect(getDefaultFilterOperator("multiSelect")).toBe("inArray");
    expect(getDefaultFilterOperator("select")).toBe("eq");
  });
});

describe("isOperatorValidForVariant", () => {
  test("accepts only operators of the variant", () => {
    expect(isOperatorValidForVariant("text", "iLike")).toBe(true);
    expect(isOperatorValidForVariant("text", "gt")).toBe(false);
    expect(isOperatorValidForVariant("boolean", "isEmpty")).toBe(false);
    expect(isOperatorValidForVariant("date", "isRelativeToToday")).toBe(true);
    expect(isOperatorValidForVariant("select", "inArray")).toBe(false);
  });
});

describe("operatorNeedsValue", () => {
  test("isEmpty and isNotEmpty need no value", () => {
    expect(operatorNeedsValue("isEmpty")).toBe(false);
    expect(operatorNeedsValue("isNotEmpty")).toBe(false);
    expect(operatorNeedsValue("eq")).toBe(true);
    expect(operatorNeedsValue("isBetween")).toBe(true);
  });
});

describe("dataTableConfig", () => {
  test("exposes variants, join operators and sort orders", () => {
    expect(dataTableConfig.filterVariants).toHaveLength(8);
    expect(dataTableConfig.joinOperators).toEqual(["and", "or"]);
    expect(dataTableConfig.sortOrders.map((order) => order.value)).toEqual(["asc", "desc"]);
  });

  test("every operator in the lists is a known operator", () => {
    const known = new Set<string>(dataTableConfig.operators);
    for (const variant of dataTableConfig.filterVariants) {
      for (const operator of getFilterOperators(variant)) {
        expect(known.has(operator.value)).toBe(true);
      }
    }
  });
});

describe("shared list vocabulary", () => {
  test("the operators offered per variant match the canonical vocabulary, in order", () => {
    for (const variant of dataTableConfig.filterVariants) {
      expect(getFilterOperators(variant).map((operator) => operator.value)).toEqual([
        ...OPERATORS_BY_VARIANT[variant],
      ]);
    }
  });
});
