/**
 * Business day boundaries for the restaurant domain. Colombia (America/Bogota) is UTC-5 all year
 * with no daylight saving time, so a fixed offset is exact and avoids Intl timezone lookups.
 */
const BOGOTA_UTC_OFFSET_HOURS = -5;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Calendar date (`YYYY-MM-DD`) of a business day in America/Bogota. */
export type BusinessDate = string;

export type BusinessDayBounds = {
  /** Inclusive start instant. */
  start: Date;
  /** Exclusive end instant (the start of the next business day). */
  end: Date;
};

/** The `[start, end)` UTC instants of a Bogota calendar date. Throws on malformed or impossible dates. */
export function businessDayBounds(date: BusinessDate): BusinessDayBounds {
  const match = DATE_PATTERN.exec(date);
  if (!match) {
    throw new Error(`Invalid business date "${date}": expected YYYY-MM-DD.`);
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const startMs = Date.UTC(year, month - 1, day, -BOGOTA_UTC_OFFSET_HOURS);
  // Reject overflow such as 2026-02-30 by checking the calendar fields survive the construction.
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error(`Invalid business date "${date}": not a calendar date.`);
  }
  return { start: new Date(startMs), end: new Date(startMs + DAY_MS) };
}

/** The Bogota calendar date an instant falls on. */
export function businessDayOf(instant: Date): BusinessDate {
  const local = new Date(instant.getTime() + BOGOTA_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}
