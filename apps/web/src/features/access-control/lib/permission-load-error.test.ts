import { describe, expect, test } from "bun:test";

import { hasPermissionLoadError } from "./permission-load-error";

/**
 * Unit tests for `hasPermissionLoadError` (T11 follow-up a/b, T10 review):
 * a permission query that already resolved once (has cached `data`) must
 * keep its consumer rendering even if a later BACKGROUND refetch errors —
 * only a query with NO data at all (the first load itself failed) should
 * report a load error.
 */
describe("hasPermissionLoadError", () => {
  test("true when the query errored and has no cached data (first load failed)", () => {
    expect(hasPermissionLoadError({ error: new Error("boom"), data: undefined })).toBe(true);
  });

  test("false when the query errored but already has cached data (a failed background refetch)", () => {
    expect(hasPermissionLoadError({ error: new Error("boom"), data: true })).toBe(false);
    expect(hasPermissionLoadError({ error: new Error("boom"), data: false })).toBe(false);
  });

  test("false while pending (no error yet, no data yet)", () => {
    expect(hasPermissionLoadError({ error: null, data: undefined })).toBe(false);
  });

  test("false once resolved successfully (data present, no error)", () => {
    expect(hasPermissionLoadError({ error: null, data: true })).toBe(false);
  });
});
