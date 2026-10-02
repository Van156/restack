// Pure logic of the advanced filter and sort builders: row creation, edits and the patches
// written to the route search. No React and no TanStack import.
import type { ColumnFilter, ColumnSort, FilterOperator, FilterVariant } from "./types";

import { getDefaultFilterOperator, getFilterOperators, operatorNeedsValue } from "./config";
import { getValidFilters } from "./filters";
import { MAX_SORT_ITEMS } from "./search";

/** The part of a column the builders need to create or retarget a filter row. */
export type FilterColumnInfo = { id: string; variant: FilterVariant };

const FILTER_ID_PATTERN = /^filter-(\d+)$/;

/** A deterministic id for a new row: `filter-N` with N one above the highest in use. */
export function nextFilterId(filters: readonly { filterId: string }[]): string {
  let highest = 0;
  for (const { filterId } of filters) {
    const match = FILTER_ID_PATTERN.exec(filterId);
    if (match) {
      highest = Math.max(highest, Number(match[1]));
    }
  }
  return `filter-${highest + 1}`;
}

const LIST_OPERATORS = new Set<FilterOperator>(["inArray", "notInArray"]);

/** The value shape `operator` needs: two ends, a list, nothing, or a single string. */
export function coerceFilterValue(
  operator: FilterOperator,
  value: string | string[],
): string | string[] {
  if (!operatorNeedsValue(operator)) {
    return "";
  }
  if (operator === "isBetween") {
    if (Array.isArray(value)) {
      return [value[0] ?? "", value[1] ?? ""];
    }
    return [value, ""];
  }
  if (LIST_OPERATORS.has(operator)) {
    if (Array.isArray(value)) {
      return value;
    }
    return value === "" ? [] : [value];
  }
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

function defaultValueFor(variant: FilterVariant, operator: FilterOperator): string | string[] {
  // A boolean has no empty state: it starts on "true" so the new row is complete.
  return variant === "boolean" ? "true" : coerceFilterValue(operator, "");
}

/** A new, empty row for `column` with its own unique `filterId` (URL filters without one are dropped). */
export function createFilter(
  column: FilterColumnInfo,
  existing: readonly { filterId: string }[],
): ColumnFilter {
  const operator = getDefaultFilterOperator(column.variant);
  return {
    id: column.id,
    variant: column.variant,
    operator,
    value: defaultValueFor(column.variant, operator),
    filterId: nextFilterId(existing),
  };
}

/** A new row for `column` already holding `raw` (the value typed or picked in the filter menu). */
export function createFilterWithValue(
  column: FilterColumnInfo,
  existing: readonly { filterId: string }[],
  raw: string,
): ColumnFilter {
  const filter = createFilter(column, existing);
  return { ...filter, value: coerceFilterValue(filter.operator, raw) };
}

/**
 * Operators the builders offer for `variant`. `isRelativeToToday` is hidden: its value has no
 * defined meaning in the URL contract or the server yet.
 */
export function getBuilderOperators(variant: FilterVariant) {
  return getFilterOperators(variant).filter(({ value }) => value !== "isRelativeToToday");
}

/** The row retargeted to another column: variant, operator and value start over, the `filterId` stays. */
export function changeFilterColumn(filter: ColumnFilter, column: FilterColumnInfo): ColumnFilter {
  const operator = getDefaultFilterOperator(column.variant);
  return {
    id: column.id,
    variant: column.variant,
    operator,
    value: defaultValueFor(column.variant, operator),
    filterId: filter.filterId,
  };
}

/** The row with another operator; its value is coerced to the shape the operator needs. */
export function changeFilterOperator(filter: ColumnFilter, operator: FilterOperator): ColumnFilter {
  return { ...filter, operator, value: coerceFilterValue(operator, filter.value) };
}

/** Applies `updates` to the row `filterId`; an operator update coerces the value like `changeFilterOperator`. */
export function updateFilter(
  filters: readonly ColumnFilter[],
  filterId: string,
  updates: Partial<Omit<ColumnFilter, "filterId">>,
): ColumnFilter[] {
  return filters.map((filter) => {
    if (filter.filterId !== filterId) {
      return filter;
    }
    const merged = { ...filter, ...updates };
    return updates.operator !== undefined && updates.value === undefined
      ? changeFilterOperator(merged, updates.operator)
      : merged;
  });
}

export function removeFilter(filters: readonly ColumnFilter[], filterId: string): ColumnFilter[] {
  return filters.filter((filter) => filter.filterId !== filterId);
}

/** Stable key of the filters that reach the URL (valid ones, in order), to compare two lists. */
export function filtersKey(filters: readonly ColumnFilter[]): string {
  return JSON.stringify(getValidFilters([...filters]));
}

/**
 * Search patch for the builder's rows: only the valid (complete) filters are written, and
 * `null` when they equal the committed ones, so an unfinished row neither reaches the URL nor
 * sends the table back to page 1.
 */
export function advancedFiltersPatch(
  next: readonly ColumnFilter[],
  committed: readonly ColumnFilter[],
): { filters: ColumnFilter[] } | null {
  if (filtersKey(next) === filtersKey(committed)) {
    return null;
  }
  return { filters: getValidFilters([...next]) };
}

export type SortColumnInfo = { id: string; label: string };

/** Sortable columns not used by any sort item yet. */
export function getAvailableSortColumns(
  columns: readonly SortColumnInfo[],
  sorting: readonly ColumnSort[],
): SortColumnInfo[] {
  const used = new Set(sorting.map((item) => item.id));
  return columns.filter((column) => !used.has(column.id));
}

/** Appends the first unused column ascending; unchanged at the maximum or with no column left. */
export function addSort(
  sorting: readonly ColumnSort[],
  columns: readonly SortColumnInfo[],
): ColumnSort[] {
  const first = getAvailableSortColumns(columns, sorting)[0];
  if (!first || sorting.length >= MAX_SORT_ITEMS) {
    return [...sorting];
  }
  return [...sorting, { id: first.id, desc: false }];
}

/** Changes the column or direction of one item; a column already sorted on is refused. */
export function updateSort(
  sorting: readonly ColumnSort[],
  id: string,
  updates: Partial<ColumnSort>,
): ColumnSort[] {
  if (updates.id !== undefined && updates.id !== id && sorting.some((s) => s.id === updates.id)) {
    return [...sorting];
  }
  return sorting.map((item) => (item.id === id ? { ...item, ...updates } : item));
}

export function removeSort(sorting: readonly ColumnSort[], id: string): ColumnSort[] {
  return sorting.filter((item) => item.id !== id);
}
