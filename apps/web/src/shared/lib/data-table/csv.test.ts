import { describe, expect, test } from "bun:test";

import { escapeCsvCell, toCsv } from "./csv";

describe("escapeCsvCell", () => {
  test("leaves plain values as they are", () => {
    expect(escapeCsvCell("hello")).toBe("hello");
    expect(escapeCsvCell(42)).toBe("42");
    expect(escapeCsvCell(true)).toBe("true");
  });

  test("renders null and undefined as empty", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  test("quotes cells with commas, quotes and newlines, doubling quotes", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvCell("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  test("neutralizes formula injection in text cells", () => {
    expect(escapeCsvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeCsvCell("+1+1")).toBe("'+1+1");
    expect(escapeCsvCell("-2+3")).toBe("'-2+3");
    expect(escapeCsvCell("@cmd")).toBe("'@cmd");
    expect(escapeCsvCell("\tcmd")).toBe("'\tcmd");
    expect(escapeCsvCell("\rcmd")).toBe('"\'\rcmd"');
  });

  test("guards before quoting", () => {
    expect(escapeCsvCell('=HYPERLINK("http://x","y")')).toBe('"\'=HYPERLINK(""http://x"",""y"")"');
  });

  test("does not guard real numbers, only text", () => {
    expect(escapeCsvCell(-5)).toBe("-5");
    expect(escapeCsvCell("-5")).toBe("'-5");
  });

  test("does not guard a formula character that is not first", () => {
    expect(escapeCsvCell("a=b")).toBe("a=b");
  });

  test("dates are ISO strings and objects are JSON", () => {
    expect(escapeCsvCell(new Date(Date.UTC(2026, 0, 2, 3, 4, 5)))).toBe("2026-01-02T03:04:05.000Z");
    expect(escapeCsvCell({ a: 1 })).toBe('"{""a"":1}"');
  });

  test("an invalid date is empty", () => {
    expect(escapeCsvCell(new Date(Number.NaN))).toBe("");
  });
});

describe("toCsv", () => {
  type Row = { name: string; note: string | null };
  const columns = [
    { header: "Name", value: (row: Row) => row.name },
    { header: "Note, long", value: (row: Row) => row.note },
  ];

  test("writes a header and one CRLF-terminated line per row", () => {
    expect(
      toCsv(
        [
          { name: "Ada", note: "a,b" },
          { name: "=cmd", note: null },
        ],
        columns,
      ),
    ).toBe('Name,"Note, long"\r\nAda,"a,b"\r\n\'=cmd,\r\n');
  });

  test("no rows is only the header", () => {
    expect(toCsv([], columns)).toBe('Name,"Note, long"\r\n');
  });

  test("headers are escaped and guarded like cells", () => {
    expect(toCsv([], [{ header: "=bad", value: () => "" }])).toBe("'=bad\r\n");
  });
});
