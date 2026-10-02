// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/registry/bases/base/hooks/use-data-table.ts at 5c2a102. nuqs is replaced by an
// injected route search (`search` + `onSearchChange`), so the hook works with any router.
import type {
  ColumnFiltersState,
  ColumnPinningState,
  PaginationState,
  ReactTable,
  RowSelectionState,
  RowData,
  SortingState,
  Updater,
  ColumnVisibilityState,
} from "@tanstack/react-table";

import { functionalUpdate, useTable } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ColumnFilter, JoinOperator } from "@/shared/lib/data-table/types";
import type {
  DataTableSearch,
  DataTableSearchConfig,
  DataTableSearchInput,
} from "@/shared/lib/data-table/search";
import type { DataTableColumnDef, DataTableFeatures } from "@/shared/lib/data-table/features";

import { useDebouncedCallback } from "@/shared/hooks/use-debounced-callback";
import { advancedFiltersPatch } from "@/shared/lib/data-table/advanced";
import { dataTableFeatures } from "@/shared/lib/data-table/features";
import { resetPageOnFilterChange, serializeDataTableSearch } from "@/shared/lib/data-table/search";
import { reconcileExternalSearch } from "@/shared/lib/data-table/search-sync";
import {
  columnFiltersToSearchPatch,
  formatFilterValue,
  getSimpleFilterColumns,
  paginationToSearchPatch,
  searchToColumnFilters,
  searchToPagination,
  sortingToSearchSort,
} from "@/shared/lib/data-table/table-state";

export const DEFAULT_DEBOUNCE_MS = 300;

/** Called with the complete next search (defaults omitted); a feature passes `navigate({ search, replace })`. */
export type DataTableSearchChange = (
  next: Record<string, unknown>,
  options: { replace: boolean },
) => void;

export type UseDataTableProps<
  TData extends RowData,
  TColumnId extends string = string,
  TFilterKey extends string = TColumnId,
> = {
  data: TData[];
  // oxlint-disable-next-line typescript/no-explicit-any -- column defs carry their own value type
  columns: DataTableColumnDef<TData, any>[];
  /** Number of pages the server reports (`getPageCount(total, perPage)`). */
  pageCount: number;
  getRowId?: (row: TData, index: number) => string;
  /** The route's validated search (`validateSearch` with `createDataTableSearchSchema`). */
  search: DataTableSearch<TFilterKey>;
  searchConfig: DataTableSearchConfig<TColumnId, TFilterKey>;
  onSearchChange: DataTableSearchChange;
  initialState?: {
    columnPinning?: ColumnPinningState;
    columnVisibility?: ColumnVisibilityState;
    rowSelection?: RowSelectionState;
  };
  /** Advanced mode: `filters` + `joinOperator` live in the search and are edited through `advanced`; simple per-column filters are off. */
  enableAdvancedFilter?: boolean;
  enableRowSelection?: boolean;
  /** Delay before a text or number filter reaches the URL. Defaults to 300 ms. */
  debounceMs?: number;
};

/** Advanced filters as the builders see them: the committed search values and their setters. */
export type DataTableAdvancedFilters = {
  /** Complete filters currently in the URL (`search.filters`). */
  filters: ColumnFilter[];
  joinOperator: JoinOperator;
  /** Delay builders apply to text and number value edits before calling `setFilters`. */
  debounceMs: number;
  /**
   * Writes the builder's rows. Only complete filters reach the URL; when they equal the
   * committed ones nothing is written. A change sends the table back to page 1.
   */
  setFilters: (filters: ColumnFilter[]) => void;
  /** Writes the join operator (page resets to 1); a no-op when unchanged. */
  setJoinOperator: (joinOperator: JoinOperator) => void;
  /** Clears every filter and the join operator in one URL write. */
  reset: () => void;
};

export type UseDataTableResult<TData extends RowData> = {
  table: ReactTable<DataTableFeatures, TData>;
  debounceMs: number;
  enableAdvancedFilter: boolean;
  advanced: DataTableAdvancedFilters;
};

const TYPED_VARIANTS = new Set(["text", "number", "range"]);

/**
 * TanStack Table (manual server mode) bound to the route search. Sorting, page, page size and
 * per-column filters are read from `search` and written through `onSearchChange`; column
 * visibility and row selection stay in table state. Filter and page size changes send the table
 * back to page 1 and defaults are omitted from the URL (`serializeDataTableSearch`).
 */
export function useDataTable<
  TData extends RowData,
  const TColumnId extends string = string,
  const TFilterKey extends string = TColumnId,
>(props: UseDataTableProps<TData, TColumnId, TFilterKey>): UseDataTableResult<TData> {
  const {
    data,
    columns,
    pageCount,
    getRowId,
    search,
    searchConfig,
    onSearchChange,
    initialState,
    enableAdvancedFilter = false,
    enableRowSelection = true,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = props;

  const latest = useRef({ search, searchConfig, onSearchChange });
  useEffect(() => {
    latest.current = { search, searchConfig, onSearchChange };
  });

  const filterColumns = useMemo(
    () => (enableAdvancedFilter ? [] : getSimpleFilterColumns(columns)),
    [columns, enableAdvancedFilter],
  );

  const commit = useCallback((patch: DataTableSearchInput<TFilterKey>) => {
    const { search: current, searchConfig: config, onSearchChange: notify } = latest.current;
    const merged = resetPageOnFilterChange(config, current, patch);
    notify(serializeDataTableSearch(config, merged), { replace: true });
  }, []);

  const pagination = useMemo(
    () => searchToPagination({ page: search.page, perPage: search.perPage }),
    [search.page, search.perPage],
  );
  const sorting: SortingState = search.sort;

  const onPaginationChange = useCallback(
    (updater: Updater<PaginationState>) => {
      const { search: current } = latest.current;
      const previous = searchToPagination({ page: current.page, perPage: current.perPage });
      const patch = paginationToSearchPatch(functionalUpdate(updater, previous), current);
      if (Object.keys(patch).length > 0) {
        commit(patch as DataTableSearchInput<TFilterKey>);
      }
    },
    [commit],
  );

  const onSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      const { search: current, searchConfig: config } = latest.current;
      const next = functionalUpdate(updater, current.sort);
      commit({
        sort: sortingToSearchSort(next, config.columnIds),
      } as DataTableSearchInput<TFilterKey>);
    },
    [commit],
  );

  // Simple filters: the URL holds the committed value, `pending` the value being typed.
  const searchFilters = useMemo(
    () => searchToColumnFilters(search, filterColumns),
    [search, filterColumns],
  );
  const searchFiltersKey = JSON.stringify(searchFilters);
  const [pending, setPending] = useState<ColumnFiltersState | null>(null);
  const committedKey = useRef(searchFiltersKey);

  const commitFilters = useCallback(
    (next: ColumnFiltersState) => {
      const patch = columnFiltersToSearchPatch(next, filterColumns, latest.current.search);
      committedKey.current = JSON.stringify(
        searchToColumnFilters(toSearchValues(next, filterColumns), filterColumns),
      );
      if (Object.keys(patch).length > 0) {
        commit(patch as DataTableSearchInput<TFilterKey>);
      }
    },
    [commit, filterColumns],
  );
  const commitFiltersDebounced = useDebouncedCallback(commitFilters, debounceMs);

  // A search that differs from what this table committed (back/forward, a link) wins over `pending`.
  useEffect(() => {
    const result = reconcileExternalSearch({
      searchKey: searchFiltersKey,
      committedKey: committedKey.current,
    });
    committedKey.current = result.committedKey;
    if (result.external) {
      commitFiltersDebounced.cancel();
      setPending(null);
    }
  }, [searchFiltersKey, commitFiltersDebounced]);

  const columnFilters: ColumnFiltersState = pending ?? searchFilters;

  const onColumnFiltersChange = useCallback(
    (updater: Updater<ColumnFiltersState>) => {
      if (enableAdvancedFilter) {
        return;
      }
      const base = pending ?? searchToColumnFilters(latest.current.search, filterColumns);
      const next = functionalUpdate(updater, base);
      setPending(next);
      // Typing is debounced; clearing a text filter (or Reset) is written at once.
      const typing = filterColumns.some(({ id, variant }) => {
        if (!TYPED_VARIANTS.has(variant)) {
          return false;
        }
        const after = formatFilterValue(variant, next.find((filter) => filter.id === id)?.value);
        const before = formatFilterValue(variant, base.find((filter) => filter.id === id)?.value);
        return after !== undefined && after !== before;
      });
      if (typing) {
        commitFiltersDebounced(next);
      } else {
        commitFiltersDebounced.cancel();
        commitFilters(next);
      }
    },
    [commitFilters, commitFiltersDebounced, enableAdvancedFilter, filterColumns, pending],
  );

  const setAdvancedFilters = useCallback(
    (next: ColumnFilter[]) => {
      const patch = advancedFiltersPatch(next, latest.current.search.filters);
      if (patch) {
        commit(patch as DataTableSearchInput<TFilterKey>);
      }
    },
    [commit],
  );

  const setJoinOperator = useCallback(
    (joinOperator: JoinOperator) => {
      if (joinOperator !== latest.current.search.joinOperator) {
        commit({ joinOperator } as DataTableSearchInput<TFilterKey>);
      }
    },
    [commit],
  );

  const resetAdvanced = useCallback(() => {
    const { filters, joinOperator } = latest.current.search;
    if (filters.length > 0 || joinOperator !== "and") {
      commit({
        filters: [] as ColumnFilter[],
        joinOperator: "and",
      } as DataTableSearchInput<TFilterKey>);
    }
  }, [commit]);

  const advanced = useMemo<DataTableAdvancedFilters>(
    () => ({
      filters: search.filters,
      joinOperator: search.joinOperator,
      debounceMs,
      setFilters: setAdvancedFilters,
      setJoinOperator,
      reset: resetAdvanced,
    }),
    [
      search.filters,
      search.joinOperator,
      debounceMs,
      setAdvancedFilters,
      setJoinOperator,
      resetAdvanced,
    ],
  );

  const table = useTable<DataTableFeatures, TData>({
    features: dataTableFeatures,
    data,
    columns,
    pageCount,
    getRowId,
    // The default sort is the sort list's "reset" target (`table.initialState.sorting`).
    initialState: { sorting: [...searchConfig.defaultSort], ...initialState },
    state: { pagination, sorting, columnFilters },
    defaultColumn: { enableColumnFilter: false },
    enableRowSelection,
    onPaginationChange,
    onSortingChange,
    onColumnFiltersChange,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  return { table, debounceMs, enableAdvancedFilter, advanced };
}

/** `columnFilters` state as the per-column search values `searchToColumnFilters` reads. */
function toSearchValues(
  filters: ColumnFiltersState,
  columns: ReturnType<typeof getSimpleFilterColumns>,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const { id, variant } of columns) {
    const formatted = formatFilterValue(variant, filters.find((filter) => filter.id === id)?.value);
    if (formatted !== undefined) {
      values[id] = formatted;
    }
  }
  return values;
}
