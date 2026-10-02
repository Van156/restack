// Pure mapping between the route search (`DataTableSearch`) and TanStack Table state
// (`sorting`, `pagination`, `columnFilters`). No React and no TanStack import: the hook wires
// these functions to `onSortingChange`/`onPaginationChange`/`onColumnFiltersChange`.
import type { ColumnSort, FilterVariant } from "./types";

import { MAX_SORT_ITEMS } from "./search";

/** A column that filters through its own search key (simple mode). */
export type SimpleFilterColumn = { id: string; variant: FilterVariant };

/** The part of a column definition needed to find the filterable columns. */
export type FilterableColumnDef = {
  id?: string;
  accessorKey?: unknown;
  enableColumnFilter?: boolean;
  meta?: { variant?: FilterVariant };
};

/** Columns that opt in with `enableColumnFilter: true`; the variant defaults to `text`. */
export function getSimpleFilterColumns(
  columns: readonly FilterableColumnDef[],
): SimpleFilterColumn[] {
  const result: SimpleFilterColumn[] = [];
  for (const column of columns) {
    const id =
      column.id ?? (typeof column.accessorKey === "string" ? column.accessorKey : undefined);
    if (id && column.enableColumnFilter === true) {
      result.push({ id, variant: column.meta?.variant ?? "text" });
    }
  }
  return result;
}

function isListVariant(variant: FilterVariant): boolean {
  return variant === "multiSelect";
}

function isRangeVariant(variant: FilterVariant): boolean {
  return variant === "range" || variant === "dateRange";
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === "";
}

/** URL string (`a,b`) to the value a column filter holds in table state. */
export function parseFilterValue(variant: FilterVariant, raw: string): string | string[] {
  if (isListVariant(variant)) {
    return raw.split(",").filter((item) => item.trim() !== "");
  }
  if (isRangeVariant(variant)) {
    const [from = "", to = ""] = raw.split(",");
    return [from, to];
  }
  return raw;
}

/**
 * Table filter value (string, number or timestamp, or a list of them) to its URL string, or
 * `undefined` when the filter is empty and its key must be dropped.
 */
export function formatFilterValue(variant: FilterVariant, value: unknown): string | undefined {
  if (isBlank(value) && !Array.isArray(value)) {
    return undefined;
  }
  const items = Array.isArray(value) ? value : [value];
  if (isListVariant(variant)) {
    const kept = items.filter((item) => !isBlank(item)).map(String);
    return kept.length > 0 ? kept.join(",") : undefined;
  }
  if (isRangeVariant(variant)) {
    return items.every(isBlank)
      ? undefined
      : items.map((item) => (isBlank(item) ? "" : String(item))).join(",");
  }
  const first = items[0];
  return isBlank(first) ? undefined : String(first);
}

export type ColumnFilterState = { id: string; value: string | string[] };

/** Table `columnFilters` state from the per-column search keys. */
export function searchToColumnFilters(
  search: Record<string, unknown>,
  columns: readonly SimpleFilterColumn[],
): ColumnFilterState[] {
  const filters: ColumnFilterState[] = [];
  for (const { id, variant } of columns) {
    const raw = search[id];
    if (typeof raw === "string" && raw !== "") {
      filters.push({ id, value: parseFilterValue(variant, raw) });
    }
  }
  return filters;
}

/**
 * Search patch for a new `columnFilters` state: only keys whose URL value changed (so an
 * unrelated change does not reset the page); a removed or emptied filter is `undefined`.
 */
export function columnFiltersToSearchPatch(
  filters: readonly { id: string; value?: unknown }[],
  columns: readonly SimpleFilterColumn[],
  current: Record<string, unknown>,
): Record<string, string | undefined> {
  const patch: Record<string, string | undefined> = {};
  for (const { id, variant } of columns) {
    const next = formatFilterValue(variant, filters.find((filter) => filter.id === id)?.value);
    const previous =
      typeof current[id] === "string" && current[id] !== "" ? current[id] : undefined;
    if (next !== previous) {
      patch[id] = next;
    }
  }
  return patch;
}

/** Sort items for the search: known ids only, first occurrence wins, at most three (spec §6.4). */
export function sortingToSearchSort(
  sorting: readonly ColumnSort[],
  sortableIds: readonly string[],
): ColumnSort[] {
  const allowed = new Set(sortableIds);
  const seen = new Set<string>();
  const result: ColumnSort[] = [];
  for (const item of sorting) {
    if (allowed.has(item.id) && !seen.has(item.id)) {
      seen.add(item.id);
      result.push({ id: item.id, desc: item.desc });
    }
  }
  return result.slice(0, MAX_SORT_ITEMS);
}

/** Table pagination state (0-based `pageIndex`) from the 1-based search `page`. */
export function searchToPagination({ page, perPage }: { page: number; perPage: number }) {
  return { pageIndex: Math.max(0, Math.floor(page) - 1), pageSize: perPage };
}

/** Search patch for a 0-based page index. */
export function pageIndexToSearchPatch(pageIndex: number): { page: number } {
  return { page: pageIndex + 1 };
}

/**
 * Search patch for a new pagination state. A page size change patches `perPage` only: the
 * table recomputes the page index for the new size, but the URL contract sends the user back
 * to page 1 (`resetPageOnFilterChange`).
 */
export function paginationToSearchPatch(
  next: { pageIndex: number; pageSize: number },
  current: { page: number; perPage: number },
): { page?: number; perPage?: number } {
  if (next.pageSize !== current.perPage) {
    return { perPage: next.pageSize };
  }
  return next.pageIndex + 1 !== current.page ? pageIndexToSearchPatch(next.pageIndex) : {};
}

/** `aria-sort` for a column header cell; only sortable columns carry it. */
export function toAriaSort(
  sorted: false | "asc" | "desc",
  canSort: boolean,
): "ascending" | "descending" | "none" | undefined {
  if (!canSort) {
    return undefined;
  }
  return sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none";
}
