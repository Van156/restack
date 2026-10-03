/** A malformed CSV; `line` is the 1-based line where the offending row starts. */
export class CsvParseError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
    this.name = "CsvParseError";
  }
}

/**
 * Minimal RFC 4180 parser: comma separated, double-quote quoting with `""` escapes, quoted fields
 * may contain commas and newlines, LF or CRLF line endings, optional UTF-8 BOM. Fully blank lines
 * are skipped. Returns rows of raw (untrimmed) fields.
 */
export function parseCsv(input: string): string[][] {
  const text = input.startsWith("﻿") ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldWasQuoted = false;
  let rowStartLine = 1;
  let line = 1;

  const endField = () => {
    row.push(field);
    field = "";
    fieldWasQuoted = false;
  };
  const endRow = () => {
    endField();
    if (!(row.length === 1 && row[0] === "")) {
      rows.push(row);
    }
    row = [];
    rowStartLine = line + 1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === "\n") {
          line += 1;
        }
        field += char;
      }
      continue;
    }
    if (char === '"') {
      if (field !== "" || fieldWasQuoted) {
        throw new CsvParseError("Unexpected quote inside a field.", rowStartLine);
      }
      inQuotes = true;
      fieldWasQuoted = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\r" && text[index + 1] === "\n") {
      // The following "\n" ends the row.
    } else if (char === "\n") {
      endRow();
      line += 1;
      rowStartLine = line;
    } else if (fieldWasQuoted) {
      throw new CsvParseError("Unexpected text after a closing quote.", rowStartLine);
    } else {
      field += char;
    }
  }
  if (inQuotes) {
    throw new CsvParseError("A quoted field is never closed.", rowStartLine);
  }
  if (field !== "" || fieldWasQuoted || row.length > 0) {
    endRow();
  }
  return rows;
}
