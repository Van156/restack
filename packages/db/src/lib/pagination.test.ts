import { describe, expect, test } from "bun:test";

import {
  clampLimit,
  DEFAULT_PAGE_SIZE,
  getMaxPage,
  MAX_OFFSET,
  MAX_PAGE_SIZE,
  toLimitOffset,
} from "./pagination";

describe("page size limits", () => {
  test("exposes the shared bounds", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(20);
    expect(MAX_PAGE_SIZE).toBe(100);
  });

  test("clampLimit defaults a missing, zero or negative limit", () => {
    expect(clampLimit(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampLimit(0)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampLimit(-5)).toBe(DEFAULT_PAGE_SIZE);
  });

  test("clampLimit caps at MAX_PAGE_SIZE and keeps valid limits", () => {
    expect(clampLimit(10)).toBe(10);
    expect(clampLimit(MAX_PAGE_SIZE)).toBe(MAX_PAGE_SIZE);
    expect(clampLimit(MAX_PAGE_SIZE + 1)).toBe(MAX_PAGE_SIZE);
  });
});

describe("toLimitOffset", () => {
  test("maps a 1-based page and page size to limit/offset", () => {
    expect(toLimitOffset({ page: 1, perPage: 20 })).toEqual({ limit: 20, offset: 0 });
    expect(toLimitOffset({ page: 3, perPage: 25 })).toEqual({ limit: 25, offset: 50 });
  });
});

describe("getMaxPage", () => {
  test("keeps the offset of the last page within MAX_OFFSET", () => {
    for (const perPage of [1, 7, 20, 25, MAX_PAGE_SIZE]) {
      const maxPage = getMaxPage(perPage);
      expect(toLimitOffset({ page: maxPage, perPage }).offset).toBeLessThanOrEqual(MAX_OFFSET);
      expect(toLimitOffset({ page: maxPage + 1, perPage }).offset).toBeGreaterThan(MAX_OFFSET);
    }
  });

  test("is at least the first page", () => {
    expect(getMaxPage(MAX_OFFSET * 2)).toBe(1);
  });
});
