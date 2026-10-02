import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";
import type { CsvColumn } from "@/shared/lib/data-table/csv";
import type { DataTableColumnDef } from "@/shared/lib/data-table/features";
import type { DataTableSearch, DataTableSearchConfig } from "@/shared/lib/data-table/search";

import { DataTable } from "@/shared/components/data-table/data-table";
import { DataTableActionBar } from "@/shared/components/data-table/data-table-action-bar";
import { DataTableAdvancedToolbar } from "@/shared/components/data-table/data-table-advanced-toolbar";
import { DataTableExportCsv } from "@/shared/components/data-table/data-table-export-csv";
import { DataTableFilterList } from "@/shared/components/data-table/data-table-filter-list";
import { DataTableSortList } from "@/shared/components/data-table/data-table-sort-list";
import { useDataTable } from "@/shared/hooks/use-data-table";
import { useResetSelectionOnChange } from "@/shared/hooks/use-reset-selection-on-change";
import { getPageCount } from "@/shared/lib/data-table/pagination";

import type { AuditLogTableRow } from "./audit-log-columns";

const NO_ROWS: never[] = [];

type AuditLogTableProps<
  TRow extends AuditLogTableRow,
  TColumnId extends string,
  TFilterKey extends string,
> = {
  search: DataTableSearch<TFilterKey>;
  searchConfig: DataTableSearchConfig<TColumnId, TFilterKey>;
  onSearchChange: DataTableSearchChange;
  // oxlint-disable-next-line typescript/no-explicit-any -- column defs carry their own value type
  columns: DataTableColumnDef<TRow, any>[];
  csvColumns: CsvColumn<TRow>[];
  csvFilename: string;
  /** The list query's state; `total` is the server's row count for the current filters. */
  list: {
    rows: TRow[] | undefined;
    total: number | undefined;
    isPending: boolean;
    isFetching: boolean;
    isPlaceholderData: boolean;
    errorMessage: string | null;
    onRetry: () => void;
  };
  /** Changes whenever the query (page, sort, filters) changes: the selection belongs to one page of results. */
  queryKey: string;
};

/**
 * Audit log table shared by the organization, platform and security log pages: advanced mode, server-driven
 * paging bound to the route search, and a selection column whose only action is a CSV export.
 * The selection clears when page, sort or filters change, so "N selected" matches the rows shown.
 */
export function AuditLogTable<
  TRow extends AuditLogTableRow,
  const TColumnId extends string,
  const TFilterKey extends string,
>({
  search,
  searchConfig,
  onSearchChange,
  columns,
  csvColumns,
  csvFilename,
  list,
  queryKey,
}: AuditLogTableProps<TRow, TColumnId, TFilterKey>) {
  const total = list.total ?? 0;
  const { table, advanced } = useDataTable({
    data: list.rows ?? NO_ROWS,
    columns,
    pageCount: getPageCount(total, search.perPage),
    getRowId: (row) => row.id,
    search,
    searchConfig,
    onSearchChange,
    enableAdvancedFilter: true,
    initialState: { columnPinning: { start: ["select"], end: [] } },
  });

  useResetSelectionOnChange(table, queryKey);

  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);

  return (
    <DataTable
      table={table}
      total={total}
      isPending={list.isPending}
      isFetching={list.isFetching}
      isPlaceholderData={list.isPlaceholderData}
      errorMessage={list.errorMessage}
      onRetry={list.onRetry}
      empty={{ title: "No activity found." }}
      actionBar={
        <DataTableActionBar
          selectedCount={selectedRows.length}
          onClearSelection={() => table.resetRowSelection()}
        >
          <DataTableExportCsv rows={selectedRows} columns={csvColumns} filename={csvFilename} />
        </DataTableActionBar>
      }
    >
      <DataTableAdvancedToolbar table={table}>
        <DataTableFilterList table={table} advanced={advanced} />
        <DataTableSortList table={table} />
      </DataTableAdvancedToolbar>
    </DataTable>
  );
}
