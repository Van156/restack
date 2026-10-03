import { describe, expect, test } from "bun:test";

import { CsvParseError, parseCsv } from "./csv";

describe("parseCsv", () => {
  test("parses plain rows with LF and CRLF line endings", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  test("keeps a final row without a trailing newline and empty fields", () => {
    expect(parseCsv("a,,c\n1,2,")).toEqual([
      ["a", "", "c"],
      ["1", "2", ""],
    ]);
  });

  test("handles quoted fields with commas, escaped quotes and newlines", () => {
    expect(parseCsv('name,note\n"Arroz, con pollo","dice ""hola"""\n"line1\nline2",x')).toEqual([
      ["name", "note"],
      ["Arroz, con pollo", 'dice "hola"'],
      ["line1\nline2", "x"],
    ]);
  });

  test("strips a UTF-8 BOM and skips blank lines", () => {
    expect(parseCsv("﻿a,b\n\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  test("returns no rows for empty input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("\n\n")).toEqual([]);
  });

  test("reports an unterminated quote", () => {
    expect(() => parseCsv('a,b\n"open,1')).toThrow(CsvParseError);
  });

  test("rejects stray quotes inside an unquoted field", () => {
    expect(() => parseCsv('a,b\nx"y,1')).toThrow(CsvParseError);
  });
});
