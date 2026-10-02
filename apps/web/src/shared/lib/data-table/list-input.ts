import { getMaxPage, MAX_FILTERS, MAX_SORT_ITEMS } from "@base-template/api/lib/list-vocabulary";
import type { z } from "zod";

import type { ColumnFilter, ColumnSort, JoinOperator } from "./types";

/** The table search keys a list input is built from (`DataTableSearch`). */
export type ListSearch = {
  page: number;
  perPage: number;
  sort: ColumnSort[];
  filters: ColumnFilter[];
  joinOperator: JoinOperator;
};

/**
 * Whether the list input `schema` (a `createListInput`) accepts `filter` on its own. The server
 * rejects the whole request on one bad filter, so a hand-edited URL (a variant that differs from
 * the column's, an option the column does not have, `isRelativeToToday`) must never reach it.
 */
export function isFilterAccepted(schema: z.ZodType, filter: ColumnFilter): boolean {
  return schema.safeParse({ filters: [filter] }).success;
}

/**
 * The server list input for a validated table search: `page`, `perPage`, `sort`, `filters` and
 * `joinOperator`. Filters the server would reject are dropped, `filters` and `sort` are capped to
 * what it accepts (`MAX_FILTERS`, `MAX_SORT_ITEMS`) and `page` is clamped to the deepest page it
 * serves, so an old or edited URL degrades to a valid request instead of a 400.
 */
export function toListInput<TSchema extends z.ZodType>(
  schema: TSchema,
  search: ListSearch,
): z.input<TSchema> {
  return {
    page: Math.min(search.page, getMaxPage(search.perPage)),
    perPage: search.perPage,
    sort: search.sort.slice(0, MAX_SORT_ITEMS),
    filters: search.filters
      .filter((filter) => isFilterAccepted(schema, filter))
      .slice(0, MAX_FILTERS),
    joinOperator: search.joinOperator,
  } as z.input<TSchema>;
}
