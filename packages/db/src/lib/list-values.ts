// Single parser for list-filter values, shared by the API list input (validation) and the
// Drizzle adapter (evaluation) so what validation accepts is exactly what the adapter accepts.
// Pure: no drizzle, pg or zod import.

export const DAY_MS = 86_400_000;

/**
 * Bounds of a date filter's epoch (0001-01-01 to 9999-12-30 UTC), so `start + DAY_MS` is always
 * a valid Date Postgres `timestamp` accepts and a day window never reaches year 10000.
 */
export const MIN_EPOCH_MS = -62_135_596_800_000;
export const MAX_EPOCH_MS = 253_402_214_400_000 - DAY_MS;

const DECIMAL = /^-?(?:\d+\.?\d*|\.\d+)$/;
const INTEGER = /^-?\d+$/;

/**
 * A number filter value: only plain decimals (optional `-`, digits, optional fraction) within the
 * safe integer range. Hex, exponents, `+` and whitespace are rejected because `Number()` accepts
 * them and Postgres then fails at query time. `integer` also rejects fractions; narrower columns
 * can still overflow in Postgres.
 */
export function parseNumberValue(
  text: string,
  options: { integer?: boolean } = {},
): number | undefined {
  if (!(options.integer ? INTEGER : DECIMAL).test(text)) {
    return undefined;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) && Math.abs(parsed) <= Number.MAX_SAFE_INTEGER
    ? parsed
    : undefined;
}

/** A date filter value: a local-midnight epoch ms integer within `MIN_EPOCH_MS..MAX_EPOCH_MS`. */
export function parseEpochValue(text: string): number | undefined {
  if (!INTEGER.test(text)) {
    return undefined;
  }
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) && parsed >= MIN_EPOCH_MS && parsed <= MAX_EPOCH_MS
    ? parsed
    : undefined;
}

/** Escapes `\`, `%` and `_` so `value` matches only as a literal substring in a `LIKE` pattern (Postgres' default escape is `\`). */
export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
