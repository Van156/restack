import { describe, expect, test } from "bun:test";

import {
  MAX_CSV_CHARACTERS,
  checkCsvFile,
  describeCsvError,
  importOutcome,
  type CsvImportResult,
} from "./csv-import";

const base: CsvImportResult = {
  valid: true,
  committed: false,
  rowCount: 3,
  errors: [],
  created: { categories: 0, items: 0, routings: 0 },
};

describe("describeCsvError", () => {
  test("names the line and column", () => {
    expect(describeCsvError({ line: 4, column: "price", message: "Must be a whole number." })).toBe(
      "Línea 4, columna «price»: Must be a whole number.",
    );
  });

  test("omits the column when the error is about the whole line", () => {
    expect(describeCsvError({ line: 2, message: "Expected 6 fields but found 5." })).toBe(
      "Línea 2: Expected 6 fields but found 5.",
    );
  });
});

describe("importOutcome", () => {
  test("a dry run without errors is ready to commit", () => {
    expect(importOutcome(base)).toEqual({ kind: "ready", rowCount: 3 });
  });

  test("errors list every line in file order and nothing is imported", () => {
    const outcome = importOutcome({
      ...base,
      valid: false,
      errors: [
        { line: 5, column: "name", message: "Duplicate." },
        { line: 3, message: "Bad row." },
      ],
    });
    expect(outcome).toEqual({
      kind: "errors",
      messages: ["Línea 3: Bad row.", "Línea 5, columna «name»: Duplicate."],
    });
  });

  test("a committed import reports what was created", () => {
    expect(
      importOutcome({
        ...base,
        committed: true,
        created: { categories: 2, items: 3, routings: 1 },
      }),
    ).toEqual({ kind: "committed", created: { categories: 2, items: 3, routings: 1 } });
  });
});

describe("checkCsvFile", () => {
  test("accepts a CSV under the size limit", () => {
    expect(checkCsvFile({ name: "menu.csv", size: 1000 })).toBeNull();
    expect(checkCsvFile({ name: "MENU.CSV", size: 1000 })).toBeNull();
  });

  test("rejects other file types", () => {
    expect(checkCsvFile({ name: "menu.xlsx", size: 1000 })).toContain("CSV");
  });

  test("rejects a file over the server limit", () => {
    expect(checkCsvFile({ name: "menu.csv", size: MAX_CSV_CHARACTERS + 1 })).toContain("grande");
  });
});
