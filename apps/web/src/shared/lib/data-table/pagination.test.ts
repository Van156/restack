import { describe, expect, test } from "bun:test";

import {
  clampPage,
  clampPerPage,
  getPageCount,
  offsetToPage,
  pageToLimitOffset,
} from "./pagination";

describe("pageToLimitOffset", () => {
  test("maps a 1-based page to limit and offset", () => {
    expect(pageToLimitOffset({ page: 1, perPage: 20 })).toEqual({ limit: 20, offset: 0 });
    expect(pageToLimitOffset({ page: 3, perPage: 20 })).toEqual({ limit: 20, offset: 40 });
  });

  test("treats a page below 1 or NaN as the first page", () => {
    expect(pageToLimitOffset({ page: 0, perPage: 10 }).offset).toBe(0);
    expect(pageToLimitOffset({ page: -4, perPage: 10 }).offset).toBe(0);
    expect(pageToLimitOffset({ page: Number.NaN, perPage: 10 }).offset).toBe(0);
  });

  test("floors fractional pages", () => {
    expect(pageToLimitOffset({ page: 2.9, perPage: 10 }).offset).toBe(10);
  });
});

describe("offsetToPage", () => {
  test("is the inverse of pageToLimitOffset for aligned offsets", () => {
    expect(offsetToPage({ offset: 0, limit: 20 })).toBe(1);
    expect(offsetToPage({ offset: 40, limit: 20 })).toBe(3);
  });

  test("an unaligned offset lands on the page that contains it", () => {
    expect(offsetToPage({ offset: 45, limit: 20 })).toBe(3);
  });

  test("guards a negative offset and an invalid limit", () => {
    expect(offsetToPage({ offset: -5, limit: 20 })).toBe(1);
    expect(offsetToPage({ offset: 40, limit: 0 })).toBe(1);
  });
});

describe("getPageCount", () => {
  test("is ceil(total / perPage) and at least one (shared semantics)", () => {
    expect(getPageCount(0, 10)).toBe(1);
    expect(getPageCount(10, 10)).toBe(1);
    expect(getPageCount(11, 10)).toBe(2);
  });
});

describe("clampPage", () => {
  test("keeps the page within 1..pageCount", () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(3, 5)).toBe(3);
    expect(clampPage(9, 5)).toBe(5);
    expect(clampPage(Number.NaN, 5)).toBe(1);
    expect(clampPage(2, 0)).toBe(1);
  });
});

describe("clampPerPage", () => {
  test("keeps perPage within 1..max and falls back to the default", () => {
    expect(clampPerPage(25, { max: 100, fallback: 20 })).toBe(25);
    expect(clampPerPage(500, { max: 100, fallback: 20 })).toBe(100);
    expect(clampPerPage(0, { max: 100, fallback: 20 })).toBe(20);
    expect(clampPerPage(Number.NaN, { max: 100, fallback: 20 })).toBe(20);
    expect(clampPerPage(7.6, { max: 100, fallback: 20 })).toBe(7);
  });
});

describe("pageToLimitOffset perPage guard", () => {
  test("an invalid perPage gives the first page of one row-free window, like offsetToPage", () => {
    for (const perPage of [Number.NaN, 0, -5, Number.POSITIVE_INFINITY]) {
      expect(pageToLimitOffset({ page: 3, perPage })).toEqual({ limit: 1, offset: 0 });
    }
  });

  test("a non-integer perPage is floored", () => {
    expect(pageToLimitOffset({ page: 3, perPage: 7.6 })).toEqual({ limit: 7, offset: 14 });
  });

  test("a perPage below one after flooring is guarded", () => {
    expect(pageToLimitOffset({ page: 2, perPage: 0.5 })).toEqual({ limit: 1, offset: 0 });
  });
});
