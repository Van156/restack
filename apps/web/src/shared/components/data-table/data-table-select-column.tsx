// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/registry/bases/base/components/data-table/data-table-select-column.tsx at 5c2a102.
import type { RowData } from "@tanstack/react-table";

import { Checkbox } from "@base-template/ui/components/checkbox";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";

type SelectColumnOptions<TData extends RowData> = Omit<
  Partial<DataTableColumnDef<TData>>,
  "id" | "header" | "cell"
>;

/** Checkbox selection column with a select-all-on-page header. Not sortable or hideable by default. */
export function getDataTableSelectColumn<TData extends RowData>({
  size = 40,
  enableHiding = false,
  enableSorting = false,
  ...options
}: SelectColumnOptions<TData> = {}): DataTableColumnDef<TData> {
  return {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all rows on this page"
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected()}
        onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label="Select row"
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onCheckedChange={(checked) => row.toggleSelected(checked)}
      />
    ),
    size,
    enableHiding,
    enableSorting,
    ...options,
  } as DataTableColumnDef<TData>;
}
