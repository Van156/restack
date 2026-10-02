import { describe, expect, test } from "bun:test";

import { getDataTableState, getOutOfRangeTarget } from "./data-table-state";

describe("getDataTableState", () => {
  test("pending wins so skeleton rows show while the first load is in flight", () => {
    expect(getDataTableState({ isPending: true, errorMessage: null, rowCount: 0 })).toEqual({
      body: "loading",
      showRefetchError: false,
    });
  });

  test("an error with no rows shows the error panel", () => {
    expect(getDataTableState({ isPending: false, errorMessage: "boom", rowCount: 0 })).toEqual({
      body: "error",
      showRefetchError: false,
    });
  });

  test("a failed background refetch keeps the cached rows and flags an inline notice", () => {
    expect(getDataTableState({ isPending: false, errorMessage: "boom", rowCount: 3 })).toEqual({
      body: "ready",
      showRefetchError: true,
    });
  });

  test("no rows shows the empty state", () => {
    expect(getDataTableState({ isPending: false, errorMessage: null, rowCount: 0 })).toEqual({
      body: "empty",
      showRefetchError: false,
    });
  });

  test("rows render the table body without a notice", () => {
    expect(getDataTableState({ isPending: false, errorMessage: undefined, rowCount: 2 })).toEqual({
      body: "ready",
      showRefetchError: false,
    });
  });

  test("an empty page past the first with a positive total is out of range", () => {
    expect(
      getDataTableState({ isPending: false, rowCount: 0, pagination: { page: 3, total: 12 } }).body,
    ).toBe("out-of-range");
  });

  test("an empty first page, or a zero total, is a plain empty state", () => {
    expect(
      getDataTableState({ isPending: false, rowCount: 0, pagination: { page: 1, total: 12 } }).body,
    ).toBe("empty");
    expect(
      getDataTableState({ isPending: false, rowCount: 0, pagination: { page: 2, total: 0 } }).body,
    ).toBe("empty");
  });

  test("pagination context does not change a page that has rows", () => {
    expect(
      getDataTableState({ isPending: false, rowCount: 2, pagination: { page: 2, total: 12 } }).body,
    ).toBe("ready");
  });
});

describe("getOutOfRangeTarget", () => {
  test("offers the last page when it differs from the current one", () => {
    expect(getOutOfRangeTarget({ page: 3, pageSize: 10, total: 12 })).toEqual({
      page: 2,
      label: "Go to last page",
    });
  });

  test("falls back to the first page when the last page is the current one (no no-op action)", () => {
    expect(getOutOfRangeTarget({ page: 2, pageSize: 10, total: 12 })).toEqual({
      page: 1,
      label: "Go to first page",
    });
  });

  test("falls back to the first page when the last page is ahead of an empty page (stale total)", () => {
    expect(getOutOfRangeTarget({ page: 2, pageSize: 10, total: 25 })).toEqual({
      page: 1,
      label: "Go to first page",
    });
  });
});
