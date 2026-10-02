import { describe, expect, test } from "bun:test";

import type { ColumnFilter } from "./types";

import { getValidFilters, isFilterValid } from "./filters";

function filter(overrides: Partial<ColumnFilter>): ColumnFilter {
  return {
    id: "name",
    value: "x",
    variant: "text",
    operator: "iLike",
    filterId: "f1",
    ...overrides,
  };
}

describe("isFilterValid", () => {
  test("a non-empty string value is valid", () => {
    expect(isFilterValid(filter({ value: "abc" }))).toBe(true);
  });

  test("empty string is incomplete", () => {
    expect(isFilterValid(filter({ value: "" }))).toBe(false);
  });

  test("isEmpty and isNotEmpty need no value", () => {
    expect(isFilterValid(filter({ operator: "isEmpty", value: "" }))).toBe(true);
    expect(isFilterValid(filter({ operator: "isNotEmpty", value: [] }))).toBe(true);
  });

  test("an empty list is incomplete, a non-empty list is valid", () => {
    const base = { variant: "multiSelect", operator: "inArray" } as const;
    expect(isFilterValid(filter({ ...base, value: [] }))).toBe(false);
    expect(isFilterValid(filter({ ...base, value: ["a"] }))).toBe(true);
  });

  test("a list holding only blanks is incomplete", () => {
    const base = { variant: "multiSelect", operator: "inArray" } as const;
    expect(isFilterValid(filter({ ...base, value: [""] }))).toBe(false);
  });

  test("isBetween needs both ends", () => {
    const base = { variant: "range", operator: "isBetween" } as const;
    expect(isFilterValid(filter({ ...base, value: ["1", "5"] }))).toBe(true);
    expect(isFilterValid(filter({ ...base, value: ["1", ""] }))).toBe(false);
    expect(isFilterValid(filter({ ...base, value: ["", "5"] }))).toBe(false);
    expect(isFilterValid(filter({ ...base, value: ["1"] }))).toBe(false);
    expect(isFilterValid(filter({ ...base, value: "1" }))).toBe(false);
  });

  test("a value that is not a string or list is incomplete", () => {
    // @ts-expect-error deliberately invalid value
    expect(isFilterValid(filter({ value: null }))).toBe(false);
    expect(isFilterValid(filter({ value: undefined }))).toBe(false);
  });
});

describe("isFilterValid value shape per operator", () => {
  test("string operators need a string, not a list", () => {
    for (const operator of ["iLike", "notILike", "eq", "ne", "lt", "lte", "gt", "gte"] as const) {
      expect(isFilterValid(filter({ operator, value: ["a"] }))).toBe(false);
      expect(isFilterValid(filter({ operator, value: "a" }))).toBe(true);
    }
  });

  test("list operators need a non-empty list, not a string", () => {
    for (const operator of ["inArray", "notInArray"] as const) {
      const base = { variant: "multiSelect", operator } as const;
      expect(isFilterValid(filter({ ...base, value: "a" }))).toBe(false);
      expect(isFilterValid(filter({ ...base, value: [] }))).toBe(false);
      expect(isFilterValid(filter({ ...base, value: ["a", "b"] }))).toBe(true);
    }
  });

  test("isRelativeToToday needs a string", () => {
    const base = { variant: "date", operator: "isRelativeToToday" } as const;
    expect(isFilterValid(filter({ ...base, value: "3" }))).toBe(true);
    expect(isFilterValid(filter({ ...base, value: ["3"] }))).toBe(false);
  });
});

describe("getValidFilters", () => {
  test("drops incomplete filters and keeps order", () => {
    const a = filter({ filterId: "a", value: "one" });
    const b = filter({ filterId: "b", value: "" });
    const c = filter({ filterId: "c", operator: "isEmpty", value: "" });
    expect(getValidFilters([a, b, c])).toEqual([a, c]);
  });

  test("returns an empty list for no filters", () => {
    expect(getValidFilters([])).toEqual([]);
  });
});
