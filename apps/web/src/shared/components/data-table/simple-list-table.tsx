import type { ReactNode } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";
import type { DataTableColumnDef } from "@/shared/lib/data-table/features";
import type { DataTableSearch, DataTableSearchConfig } from "@/shared/lib/data-table/search";

import { DataTable } from "./data-table";
import { DataTableToolbar } from "./data-table-toolbar";
import { useDataTable } from "@/shared/hooks/use-data-table";
import { getPageCount } from "@/shared/lib/data-table/pagination";

type SimpleListTableProps<
  TRow extends { id: string },
  TColumnId extends string,
  TFilterKey extends string,
> = {
  search: DataTableSearch<TFilterKey>;
  searchConfig: DataTableSearchConfig<TColumnId, TFilterKey>;
  onSearchChange: DataTableSearchChange;
  // oxlint-disable-next-line typescript/no-explicit-any -- column defs carry their own value type
  columns: DataTableColumnDef<TRow, any>[];
  emptyTitle: string;
  emptyIcon?: ReactNode;
  /** The list query's state; `total` is the row count for the current filters, not the page. */
  list: {
    rows: TRow[] | undefined;
    total: number | undefined;
    isPending: boolean;
    isFetching: boolean;
    isPlaceholderData: boolean;
    errorMessage: string | null;
    onRetry: () => void;
  };
};

/**
 * Simple-mode list table: one filter per column, header sort, paging bound to the route (or local)
 * search, no selection or bulk actions (spec §2). The caller owns `list`: its rows, the total for
 * the current filters and the query state.
 */
export function SimpleListTable<
  TRow extends { id: string },
  const TColumnId extends string,
  const TFilterKey extends string,
>({
  search,
  searchConfig,
  onSearchChange,
  columns,
  emptyTitle,
  emptyIcon,
  list,
}: SimpleListTableProps<TRow, TColumnId, TFilterKey>) {
  const total = list.total ?? 0;
  const { table } = useDataTable({
    data: list.rows ?? NO_ROWS,
    columns,
    pageCount: getPageCount(total, search.perPage),
    getRowId: (row) => row.id,
    search,
    searchConfig,
    onSearchChange,
    enableRowSelection: false,
  });

  return (
    <DataTable
      table={table}
      total={total}
      isPending={list.isPending}
      isFetching={list.isFetching}
      isPlaceholderData={list.isPlaceholderData}
      errorMessage={list.errorMessage}
      onRetry={list.onRetry}
      empty={{ title: emptyTitle, icon: emptyIcon }}
    >
      <DataTableToolbar table={table} />
    </DataTable>
  );
}

const NO_ROWS: never[] = [];
