// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: date helpers of src/registry/bases/base/components/data-table/data-table-date-filter.tsx at 5c2a102.
import { format } from "date-fns";

/** A millisecond timestamp (number or numeric string, as read from the URL) as a `Date`. */
export function parseTimestamp(value: unknown): Date | undefined {
  if (typeof value !== "number" && typeof value !== "string") {
    return undefined;
  }
  if (value === "" || value === 0) {
    return undefined;
  }
  const date = new Date(Number(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** `[from, to]` timestamps for a column filter; an open end is `undefined`, an empty range clears the filter. */
export function dateRangeToFilterValue(
  range: { from?: Date; to?: Date } | undefined,
): [number | undefined, number | undefined] | undefined {
  const from = range?.from?.getTime();
  const to = range?.to?.getTime();
  return from === undefined && to === undefined ? undefined : [from, to];
}

/** A date as `Jan 05, 2024` for the filter trigger; an unset date is an empty string. */
export function formatFilterDate(date: Date | undefined): string {
  return date ? format(date, "LLL dd, y") : "";
}
