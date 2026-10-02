import { describe, expect, test } from "bun:test";

import { getPageCount, isValidPageSize } from "./pagination";

describe("getPageCount", () => {
  test("rounds up and never returns less than one page", () => {
    expect(getPageCount(0, 10)).toBe(1);
    expect(getPageCount(10, 10)).toBe(1);
    expect(getPageCount(11, 10)).toBe(2);
    expect(getPageCount(95, 10)).toBe(10);
  });

  test("guards against a non-positive or non-finite page size", () => {
    expect(getPageCount(50, 0)).toBe(1);
    expect(getPageCount(50, -5)).toBe(1);
    expect(getPageCount(50, Number.NaN)).toBe(1);
  });

  test("treats a negative or NaN total as empty", () => {
    expect(getPageCount(-3, 10)).toBe(1);
    expect(getPageCount(Number.NaN, 10)).toBe(1);
  });
});

describe("isValidPageSize", () => {
  test("accepts only positive finite numbers", () => {
    expect(isValidPageSize(10)).toBe(true);
    expect(isValidPageSize(0)).toBe(false);
    expect(isValidPageSize(-1)).toBe(false);
    expect(isValidPageSize(Number.NaN)).toBe(false);
    expect(isValidPageSize(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
