// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: getValidFilters in src/lib/data-table-utils.ts at 5c2a102; stricter for ranges and blank list items.
import type { ColumnFilter } from "./types";

import { operatorNeedsValue } from "./config";

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim() === "";
}

const LIST_OPERATORS = new Set<string>(["inArray", "notInArray"]);

/**
 * A filter is complete when it can be evaluated and its value has the shape its operator
 * needs: `isEmpty`/`isNotEmpty` need no value, `isBetween` needs two non-blank ends,
 * `inArray`/`notInArray` need a non-empty list of non-blank items, and every other operator
 * (`iLike`, `eq`, `lt`, `isRelativeToToday`, ...) needs a non-blank string.
 */
export function isFilterValid(filter: ColumnFilter): boolean {
  if (!operatorNeedsValue(filter.operator)) {
    return true;
  }
  const { value } = filter;
  if (filter.operator === "isBetween") {
    return Array.isArray(value) && value.length === 2 && value.every((end) => !isBlank(end));
  }
  if (LIST_OPERATORS.has(filter.operator)) {
    return Array.isArray(value) && value.length > 0 && value.every((item) => !isBlank(item));
  }
  return !isBlank(value);
}

/** Drops incomplete filters (builder rows the user has not finished) before they reach the URL or the server. */
export function getValidFilters<TFilter extends ColumnFilter>(filters: TFilter[]): TFilter[] {
  return filters.filter(isFilterValid);
}
