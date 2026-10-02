// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/lib/parsers.ts at 5c2a102 (nuqs parsers), ported to a zod schema for TanStack Router `validateSearch`.
// URL shape and router JSON round trip: docs/architecture/data-table.md#url-search-shape.
import { MAX_SORT_ITEMS } from "@base-template/api/lib/list-vocabulary";
import { z } from "zod";

import type { ColumnFilter, ColumnSort, JoinOperator } from "./types";

import { dataTableConfig, isOperatorValidForVariant } from "./config";
import { isFilterValid } from "./filters";

/** Keys the table owns in the URL; a column id may not reuse them (simple filters use the column id as key). */
const RESERVED_KEYS = ["page", "perPage", "sort", "filters", "joinOperator"] as const;

/** The server list input's sort cap (spec §6.4), shared through the list vocabulary. */
export { MAX_SORT_ITEMS };
const DEFAULT_MAX_PER_PAGE = 100;

export type DataTableSearchConfig<
  TColumnId extends string = string,
  TFilterKey extends string = TColumnId,
> = {
  /** Sortable column ids. */
  columnIds: readonly TColumnId[];
  /**
   * Columns that can be filtered (advanced `filters` ids and simple per-column keys). Defaults to
   * `columnIds`; it may include columns that cannot be sorted (an actor id, say).
   */
  filterableColumnIds?: readonly TFilterKey[];
  defaultSort: readonly ColumnSort[];
  defaultPerPage: number;
  /** When set, only these page sizes are accepted. */
  perPageOptions?: readonly number[];
  /** Upper bound for `perPage`. Defaults to 100 (`MAX_PAGE_SIZE`). */
  maxPerPage?: number;
};

export type DataTableSearch<TFilterKey extends string = never> = {
  page: number;
  perPage: number;
  sort: ColumnSort[];
  filters: ColumnFilter[];
  joinOperator: JoinOperator;
} & { [K in TFilterKey]?: string };

/** What a link may pass: every key is optional because each falls back to its default. */
export type DataTableSearchInput<TFilterKey extends string = never> = Partial<
  DataTableSearch<TFilterKey>
>;

const sortItemSchema = z.object({ id: z.string(), desc: z.boolean() });

const filterItemSchema = z.object({
  id: z.string(),
  value: z.union([z.string(), z.array(z.string())]),
  variant: z.enum(dataTableConfig.filterVariants),
  operator: z.enum(dataTableConfig.operators),
  filterId: z.string().min(1),
});

/** A search value is a JSON string (hand-typed URL) or already parsed by the router. */
function parseJsonLike(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function toItems(value: unknown): unknown[] | undefined {
  const parsed = parseJsonLike(value);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  return parsed && typeof parsed === "object" ? [parsed] : undefined;
}

function normalizeSimpleValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value === "" ? undefined : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value.filter(
      (part): part is string | number | boolean =>
        typeof part === "string" || typeof part === "number" || typeof part === "boolean",
    );
    return parts.length > 0 ? parts.join(",") : undefined;
  }
  return undefined;
}

/**
 * Zod schema for a route's `validateSearch`. Every key falls back to its default instead of
 * throwing: bad `page`/`perPage`/`joinOperator` use the default, `sort`/`filters` drop invalid
 * items (sort reverts to `defaultSort` when none remain), unknown keys are stripped.
 */
export function createDataTableSearchSchema<
  const TColumnId extends string,
  const TFilterKey extends string = TColumnId,
>(
  config: DataTableSearchConfig<TColumnId, TFilterKey>,
): z.ZodType<DataTableSearch<TFilterKey>, DataTableSearchInput<TFilterKey>> {
  const maxPerPage = config.maxPerPage ?? DEFAULT_MAX_PER_PAGE;
  const sortableIds = new Set<string>(config.columnIds);
  const filterableIds = [...(config.filterableColumnIds ?? config.columnIds)];
  const filterableSet = new Set<string>(filterableIds);
  const defaultSort = config.defaultSort.map((item) => ({ ...item }));

  for (const id of filterableIds) {
    if ((RESERVED_KEYS as readonly string[]).includes(id)) {
      throw new Error(`Column id "${id}" collides with a reserved data table search key`);
    }
  }

  const perPage = z
    .number()
    .int()
    .min(1)
    .max(maxPerPage)
    .refine((value) => !config.perPageOptions || config.perPageOptions.includes(value))
    .catch(config.defaultPerPage);

  const sort = z
    .unknown()
    .optional()
    .transform((value): ColumnSort[] => {
      const items = toItems(value);
      if (!items) {
        return defaultSort;
      }
      if (items.length === 0) {
        return [];
      }
      const seen = new Set<string>();
      const valid: ColumnSort[] = [];
      for (const item of items) {
        const result = sortItemSchema.safeParse(item);
        if (result.success && sortableIds.has(result.data.id) && !seen.has(result.data.id)) {
          seen.add(result.data.id);
          valid.push(result.data);
        }
      }
      return valid.length > 0 ? valid.slice(0, MAX_SORT_ITEMS) : defaultSort;
    });

  const filters = z
    .unknown()
    .optional()
    .transform((value): ColumnFilter[] => {
      const items = toItems(value) ?? [];
      const valid: ColumnFilter[] = [];
      for (const item of items) {
        const result = filterItemSchema.safeParse(item);
        if (
          result.success &&
          filterableSet.has(result.data.id) &&
          isOperatorValidForVariant(result.data.variant, result.data.operator) &&
          isFilterValid(result.data)
        ) {
          valid.push(result.data);
        }
      }
      return valid;
    });

  const simpleFilters = Object.fromEntries(filterableIds.map((id) => [id, z.unknown().optional()]));

  const schema = z.preprocess(
    (input) => (input && typeof input === "object" && !Array.isArray(input) ? input : {}),
    z
      .object({
        ...simpleFilters,
        page: z.number().int().min(1).catch(1),
        perPage,
        sort,
        filters,
        joinOperator: z.enum(dataTableConfig.joinOperators).catch("and"),
      })
      .transform((parsed) => {
        // Simple filter values are normalized here: an optional output would not survive `z.object`.
        const out: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(parsed)) {
          const normalized = filterableSet.has(key) ? normalizeSimpleValue(value) : value;
          if (normalized !== undefined) {
            out[key] = normalized;
          }
        }
        return out;
      }),
  );

  return schema as unknown as z.ZodType<
    DataTableSearch<TFilterKey>,
    DataTableSearchInput<TFilterKey>
  >;
}

function sortEquals(a: readonly ColumnSort[], b: readonly ColumnSort[]): boolean {
  return (
    a.length === b.length && a.every((item, i) => item.id === b[i]?.id && item.desc === b[i]?.desc)
  );
}

/**
 * Search object for `navigate({ search })` / `<Link search>` with every default left out
 * (the `clearOnDefault` behaviour), so a pristine table has a clean URL. Incomplete filters and
 * empty simple values are dropped. An empty `sort` is kept when the default is not empty: it
 * means "unsorted".
 */
export function serializeDataTableSearch<
  const TColumnId extends string,
  const TFilterKey extends string = TColumnId,
>(
  config: DataTableSearchConfig<TColumnId, TFilterKey>,
  state: NoInfer<DataTableSearchInput<TFilterKey>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (state.page !== undefined && state.page !== 1) {
    out.page = state.page;
  }
  if (state.perPage !== undefined && state.perPage !== config.defaultPerPage) {
    out.perPage = state.perPage;
  }
  if (state.sort !== undefined && !sortEquals(state.sort, config.defaultSort)) {
    out.sort = state.sort;
  }
  const filters = (state.filters ?? []).filter(isFilterValid);
  if (filters.length > 0) {
    out.filters = filters;
  }
  if (state.joinOperator !== undefined && state.joinOperator !== "and") {
    out.joinOperator = state.joinOperator;
  }
  for (const id of config.filterableColumnIds ?? config.columnIds) {
    const value = normalizeSimpleValue((state as Record<string, unknown>)[id]);
    if (value !== undefined) {
      out[id] = value;
    }
  }
  return out;
}

/**
 * Applies a search patch and sends the table back to page 1 when the patch changes the result
 * set: any filter (`filters`, `joinOperator`, a simple column key) or `perPage`. Sort and page
 * patches keep the page; an explicit `page` in the patch always wins. Returns a new object; a
 * key patched to `undefined` is removed.
 */
export function resetPageOnFilterChange<
  const TColumnId extends string,
  const TFilterKey extends string = TColumnId,
>(
  config: DataTableSearchConfig<TColumnId, TFilterKey>,
  current: NoInfer<DataTableSearchInput<TFilterKey>>,
  patch: NoInfer<DataTableSearchInput<TFilterKey>>,
): DataTableSearchInput<TFilterKey> {
  const resetKeys = new Set<string>([
    "filters",
    "joinOperator",
    "perPage",
    ...(config.filterableColumnIds ?? config.columnIds),
  ]);
  const changesResults = Object.keys(patch).some((key) => resetKeys.has(key));
  const next: Record<string, unknown> = { ...current, ...patch };
  if (changesResults && patch.page === undefined) {
    next.page = 1;
  }
  for (const key of Object.keys(next)) {
    if (next[key] === undefined) {
      delete next[key];
    }
  }
  return next as DataTableSearchInput<TFilterKey>;
}

/**
 * The route search after the table writes `next` (its own keys, defaults omitted): every key the
 * table owns (`page`, `perPage`, `sort`, `filters`, `joinOperator`, the per-column filter keys)
 * is replaced by `next`, and keys of other concerns (a tab, a redirect) are kept.
 */
export function mergeTableSearch<
  const TColumnId extends string,
  const TFilterKey extends string = TColumnId,
>(
  config: DataTableSearchConfig<TColumnId, TFilterKey>,
  current: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const owned = new Set<string>([
    ...RESERVED_KEYS,
    ...(config.filterableColumnIds ?? config.columnIds),
  ]);
  const kept = Object.fromEntries(Object.entries(current).filter(([key]) => !owned.has(key)));
  return { ...kept, ...next };
}
