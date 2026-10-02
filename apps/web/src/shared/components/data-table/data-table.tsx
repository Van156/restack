// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/registry/bases/base/components/data-table/data-table.tsx at 5c2a102, with the
// loading, empty, error, refetch error and out-of-range states of the previous shared table.
import type { RowData } from "@tanstack/react-table";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@base-template/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";
import { cn } from "@base-template/ui/lib/utils";
import { FlexRender } from "@tanstack/react-table";

import type { DataTableInstance } from "@/shared/lib/data-table/features";

import EmptyState from "@/shared/components/feedback/empty-state";
import LoadError from "@/shared/components/feedback/load-error";
import { getColumnPinningStyle } from "@/shared/lib/data-table/column-pinning";
import { toAriaSort } from "@/shared/lib/data-table/table-state";
import { getDataTableState, getOutOfRangeTarget } from "@/shared/lib/data-table-state";

import { DataTablePagination } from "./data-table-pagination";
import { DataTableSkeleton } from "./data-table-skeleton";

export type DataTableEmptyState = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

type DataTableProps<TData extends RowData> = Omit<ComponentProps<"div">, "children"> & {
  table: DataTableInstance<TData>;
  /** Total rows on the server, for the out-of-range page recovery. */
  total: number;
  /** The toolbar (`DataTableToolbar`), rendered above the table and kept in every state but the first load. */
  children?: ReactNode;
  /** Shown below the pagination while rows are selected (usually a `DataTableActionBar`). */
  actionBar?: ReactNode;
  /** First load, no data yet: shows the skeleton. */
  isPending?: boolean;
  /** The last fetch failed: an error panel when there are no rows, an inline notice otherwise. */
  errorMessage?: string | null;
  /** Retry action; the buttons are hidden when omitted. */
  onRetry?: () => void;
  empty: DataTableEmptyState;
  /** A page change is in flight: the pagination controls are disabled. */
  isFetching?: boolean;
  isPlaceholderData?: boolean;
  pageSizeOptions?: number[];
  skeletonRows?: number;
};

/**
 * Server-driven table for a `useDataTable` instance. Bind it to the list query:
 *
 * - `isPending`: first load, no data yet (skeleton).
 * - `errorMessage`: with no rows the error panel replaces the table (Retry appears only with
 *   `onRetry`); with cached rows the rows stay and an inline notice is shown.
 * - `isFetching` / `isPlaceholderData`: a page change is in flight; pagination is disabled.
 * - An empty page past the first while `total > 0` offers "Go to last page" (or "Go to first
 *   page" when the last page is the current one).
 * - No rows on the first page: the `empty` state. The toolbar stays so filters can be reset.
 */
export function DataTable<TData extends RowData>({
  table,
  total,
  children,
  actionBar,
  isPending = false,
  errorMessage,
  onRetry,
  empty,
  isFetching = false,
  isPlaceholderData = false,
  pageSizeOptions,
  skeletonRows = 10,
  className,
  ...props
}: DataTableProps<TData>) {
  const { pageIndex, pageSize } = table.state.pagination;
  const rows = table.getRowModel().rows;
  const { body, showRefetchError } = getDataTableState({
    isPending,
    errorMessage,
    rowCount: rows.length,
    pagination: { page: pageIndex + 1, total },
  });

  if (body === "loading") {
    return (
      <DataTableSkeleton
        className={className}
        columnCount={table.getVisibleLeafColumns().length || 1}
        filterCount={table.getAllColumns().filter((column) => column.getCanFilter()).length}
        rowCount={skeletonRows}
        {...props}
      />
    );
  }

  const target = getOutOfRangeTarget({ page: pageIndex + 1, pageSize, total });
  const selectedCount = Object.keys(table.state.rowSelection).length;

  return (
    <div className={cn("flex w-full flex-col gap-2.5 overflow-auto", className)} {...props}>
      {children}
      {body === "error" ? (
        <LoadError message={errorMessage ?? ""} onRetry={onRetry} />
      ) : body === "empty" ? (
        <EmptyState {...empty} />
      ) : body === "out-of-range" ? (
        <EmptyState
          title="This page is empty"
          description="There are no rows on this page anymore."
          action={
            <Button onClick={() => table.setPageIndex(target.page - 1)}>{target.label}</Button>
          }
        />
      ) : (
        <>
          {showRefetchError ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
              {onRetry ? (
                <Button variant="link" size="sm" onClick={onRetry}>
                  Retry
                </Button>
              ) : null}
            </p>
          ) : null}
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        aria-sort={toAriaSort(
                          header.column.getIsSorted(),
                          header.column.getCanSort(),
                        )}
                        style={getColumnPinningStyle({ column: header.column })}
                      >
                        {header.isPlaceholder ? null : <FlexRender header={header} />}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        style={getColumnPinningStyle({ column: cell.column })}
                      >
                        <FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-2.5">
            <DataTablePagination
              table={table}
              pageSizeOptions={pageSizeOptions}
              disabled={isFetching || isPlaceholderData}
            />
            {actionBar && selectedCount > 0 ? actionBar : null}
          </div>
        </>
      )}
    </div>
  );
}
