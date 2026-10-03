/** Mirrors the server limit of one bulk add. */
export const MAX_BULK_TABLES = 200;
const MAX_SEATS = 100;
const MAX_START = 100_000;

export type BulkTablesValues = { pattern: string; start: string; count: string; seats: string };
export type BulkTablesInput = { pattern: string; start: number; count: number; seats: number };
export type BulkTablesErrors = Partial<Record<keyof BulkTablesValues, string>>;

const PREVIEW_HEAD = 3;

/** Example names for the pattern: the first few and the last, so a long run stays readable. */
export function tableNamePreview(pattern: string, start: number, count: number): string[] {
  const name = (index: number) => pattern.replaceAll("{n}", String(start + index));
  if (count <= PREVIEW_HEAD + 1) {
    return Array.from({ length: count }, (_, index) => name(index));
  }
  return [...Array.from({ length: PREVIEW_HEAD }, (_, index) => name(index)), "…", name(count - 1)];
}

function wholeNumber(text: string): number {
  return /^\d+$/.test(text.trim()) ? Number(text) : Number.NaN;
}

/** Parses the bulk-add form; the server re-validates and rejects taken names. */
export function validateBulkTables(
  values: BulkTablesValues,
): { ok: true; value: BulkTablesInput } | { ok: false; errors: BulkTablesErrors } {
  const errors: BulkTablesErrors = {};
  const pattern = values.pattern.trim();
  if (!pattern.includes("{n}")) {
    errors.pattern = "El nombre debe incluir {n}, por ejemplo «Mesa {n}».";
  }
  const start = wholeNumber(values.start);
  if (!Number.isInteger(start) || start > MAX_START) {
    errors.start = "Usa un número entero desde 0.";
  }
  const count = wholeNumber(values.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_BULK_TABLES) {
    errors.count = `Agrega entre 1 y ${MAX_BULK_TABLES} mesas a la vez.`;
  }
  const seats = wholeNumber(values.seats);
  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
    errors.seats = `Los puestos van de 1 a ${MAX_SEATS}.`;
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { pattern, start, count, seats } };
}
