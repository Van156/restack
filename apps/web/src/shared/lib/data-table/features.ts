// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/lib/data-table-features.ts and src/lib/data-table-types.ts at 5c2a102, for TanStack Table v9.
// No client row models: the server sorts, filters and pages (spec R2), and with the `manual*`
// flags table-core 9.2.4 renders the rows it is given.
import type { ColumnDef, ReactTable, Row, RowData } from "@tanstack/react-table";

import {
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/react-table";

import type { DataTableColumnMeta, FilterVariant } from "./types";

export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;

/** The table `useDataTable` returns (a TanStack React table, `table.state` readable during render). */
export type DataTableInstance<TData extends RowData> = ReactTable<DataTableFeatures, TData>;

/** A column definition bound to the data table features (typed `meta`, `enableColumnFilter`, ...). */
export type DataTableColumnDef<TData extends RowData, TValue = unknown> = ColumnDef<
  DataTableFeatures,
  TData,
  TValue
>;

/** A row-level action a row menu can request from its page (e.g. open an edit or delete dialog). */
export type DataTableRowAction<
  TData extends RowData,
  TVariant extends string = "update" | "delete",
> = {
  row: Row<DataTableFeatures, TData>;
  variant: TVariant;
};

/** The current value of the column filter `columnId`, read from render-time table state. */
export function getColumnFilterValue<TData extends RowData>(
  table: DataTableInstance<TData>,
  columnId: string,
): unknown {
  return table.state.columnFilters.find((filter) => filter.id === columnId)?.value;
}

/** A column the advanced filter builders can target. */
export type FilterBuilderColumn = {
  id: string;
  label: string;
  variant: FilterVariant;
  meta: DataTableColumnMeta | undefined;
};

/** Filterable columns (`enableColumnFilter: true`) with their label and variant (`text` by default). */
export function getFilterBuilderColumns<TData extends RowData>(
  table: DataTableInstance<TData>,
): FilterBuilderColumn[] {
  return table
    .getAllColumns()
    .filter((column) => column.getCanFilter())
    .map((column) => ({
      id: column.id,
      label: column.columnDef.meta?.label ?? column.id,
      variant: column.columnDef.meta?.variant ?? "text",
      meta: column.columnDef.meta,
    }));
}

/** Sortable columns with their label, for the sort list. */
export function getSortBuilderColumns<TData extends RowData>(
  table: DataTableInstance<TData>,
): { id: string; label: string }[] {
  return table
    .getAllColumns()
    .filter((column) => column.getCanSort())
    .map((column) => ({ id: column.id, label: column.columnDef.meta?.label ?? column.id }));
}
