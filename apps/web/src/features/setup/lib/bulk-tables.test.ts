import { describe, expect, test } from "bun:test";

import { MAX_BULK_TABLES, tableNamePreview, validateBulkTables } from "./bulk-tables";

const valid = { pattern: "Mesa {n}", start: "1", count: "30", seats: "4" };

describe("tableNamePreview", () => {
  test("numbers the pattern from the start value", () => {
    expect(tableNamePreview("Mesa {n}", 1, 3)).toEqual(["Mesa 1", "Mesa 2", "Mesa 3"]);
  });

  test("shows only the first names and the last one for long runs", () => {
    expect(tableNamePreview("T{n}", 1, 30)).toEqual(["T1", "T2", "T3", "…", "T30"]);
  });

  test("replaces every placeholder", () => {
    expect(tableNamePreview("{n}-{n}", 5, 1)).toEqual(["5-5"]);
  });
});

describe("validateBulkTables", () => {
  test("parses the numeric fields", () => {
    expect(validateBulkTables(valid)).toEqual({
      ok: true,
      value: { pattern: "Mesa {n}", start: 1, count: 30, seats: 4 },
    });
  });

  test("requires the {n} placeholder", () => {
    const result = validateBulkTables({ ...valid, pattern: "Mesa" });
    expect(!result.ok && result.errors.pattern).toBeDefined();
  });

  test("bounds the count by the server limit", () => {
    expect(validateBulkTables({ ...valid, count: String(MAX_BULK_TABLES) }).ok).toBe(true);
    const over = validateBulkTables({ ...valid, count: String(MAX_BULK_TABLES + 1) });
    expect(!over.ok && over.errors.count).toBeDefined();
    const zero = validateBulkTables({ ...valid, count: "0" });
    expect(!zero.ok && zero.errors.count).toBeDefined();
  });

  test("seats are 1 to 100", () => {
    expect(validateBulkTables({ ...valid, seats: "0" }).ok).toBe(false);
    expect(validateBulkTables({ ...valid, seats: "101" }).ok).toBe(false);
    expect(validateBulkTables({ ...valid, seats: "100" }).ok).toBe(true);
  });

  test("start is a non-negative integer", () => {
    expect(validateBulkTables({ ...valid, start: "-1" }).ok).toBe(false);
    expect(validateBulkTables({ ...valid, start: "1.5" }).ok).toBe(false);
    expect(validateBulkTables({ ...valid, start: "0" }).ok).toBe(true);
  });
});
