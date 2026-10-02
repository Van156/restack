/** One CSV column: its header and how to read the cell from a row. */
export type CsvColumn<TRow> = {
  header: string;
  value: (row: TRow) => unknown;
};

const LINE_END = "\r\n";
/** Leading characters a spreadsheet may read as the start of a formula (OWASP CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

function toText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * One CSV cell (RFC 4180): quoted when it holds a comma, quote or line break (quotes doubled).
 * A text cell starting with `=`, `+`, `-`, `@`, tab or CR is prefixed with `'` so a spreadsheet
 * shows it as text instead of evaluating it; real numbers are not text and are left alone.
 */
export function escapeCsvCell(value: unknown): string {
  const text = toText(value);
  const guarded = typeof value === "string" && FORMULA_START.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded;
}

/** CSV text for `rows`: a header line, then one line per row, each ended by CRLF. No BOM. */
export function toCsv<TRow>(rows: readonly TRow[], columns: readonly CsvColumn<TRow>[]): string {
  const header = columns.map((column) => escapeCsvCell(column.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((column) => escapeCsvCell(column.value(row))).join(","),
  );
  return [header, ...lines].map((line) => line + LINE_END).join("");
}
