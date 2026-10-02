import { MAX_FILTER_VALUE_LENGTH } from "@base-template/api/lib/list-vocabulary";

import { getDefaultFilterOperator } from "./config";
import { isFilterValid } from "./filters";
import { parseFilterValue } from "./table-state";
import type { ColumnFilter, FilterVariant } from "./types";

/**
 * `isAccepted` for `normalizeSimpleSearch` when the list is not behind a `createListInput` (a
 * better-auth endpoint, an in-memory list): any single string value up to the list input's cap.
 */
export function isBoundedStringFilter(filter: ColumnFilter): boolean {
  return typeof filter.value === "string" && filter.value.length <= MAX_FILTER_VALUE_LENGTH;
}

/**
 * The filters of a simple-mode search (one URL key per filterable column) as list-input
 * `ColumnFilter`s, so the same `createListInput` the advanced tables use validates them. Each
 * filter takes its variant's default operator (the one the simple toolbar widgets write: text
 * `iLike`, select `eq`, multiSelect `inArray`). Blank values and keys that are not columns
 * are ignored.
 */
export function simpleSearchToFilters(
  search: Record<string, unknown>,
  columns: Readonly<Record<string, FilterVariant>>,
): ColumnFilter[] {
  const filters: ColumnFilter[] = [];
  for (const [id, variant] of Object.entries(columns)) {
    const raw = search[id];
    if (typeof raw !== "string" || raw === "") {
      continue;
    }
    const filter: ColumnFilter = {
      id,
      value: parseFilterValue(variant, raw),
      variant,
      operator: getDefaultFilterOperator(variant),
      filterId: `simple-${id}`,
    };
    if (isFilterValid(filter)) {
      filters.push(filter);
    }
  }
  return filters;
}

/**
 * A simple-mode search made consistent with its list input: every per-column key whose filter
 * the server would reject is dropped, and the advanced `filters`/`joinOperator` keys, which a
 * simple table never writes, are reset (a hand-edited URL cannot smuggle them into the request).
 */
export function normalizeSimpleSearch<TSearch extends Record<string, unknown>>(
  search: TSearch,
  columns: Readonly<Record<string, FilterVariant>>,
  isAccepted: (filter: ColumnFilter) => boolean,
): TSearch {
  const rejected = new Set(
    simpleSearchToFilters(search, columns)
      .filter((filter) => !isAccepted(filter))
      .map((filter) => filter.id),
  );
  const kept = Object.fromEntries(
    Object.entries(search).filter(([key, value]) => !rejected.has(key) && value !== undefined),
  );
  // A key whose value could not become a valid filter (a blank one) is dropped too.
  for (const id of Object.keys(columns)) {
    if (id in kept && !simpleSearchToFilters(kept, { [id]: columns[id]! }).length) {
      delete kept[id];
    }
  }
  return { ...kept, filters: [], joinOperator: "and" } as unknown as TSearch;
}
