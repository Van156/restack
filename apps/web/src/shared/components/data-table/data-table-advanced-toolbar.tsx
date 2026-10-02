// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/registry/bases/base/components/data-table/data-table-advanced-toolbar.tsx at 5c2a102.
import type { RowData } from "@tanstack/react-table";
import type { ComponentProps } from "react";

import { cn } from "@base-template/ui/lib/utils";

import type { DataTableInstance } from "@/shared/lib/data-table/features";

import { DataTableViewOptions } from "./data-table-view-options";

type DataTableAdvancedToolbarProps<TData extends RowData> = ComponentProps<"div"> & {
  table: DataTableInstance<TData>;
};

/**
 * Toolbar for advanced mode: `children` (the filter list or menu, the sort list, page actions)
 * on the left and the view options on the right.
 */
export function DataTableAdvancedToolbar<TData extends RowData>({
  table,
  children,
  className,
  ...props
}: DataTableAdvancedToolbarProps<TData>) {
  return (
    <div
      role="toolbar"
      aria-orientation="horizontal"
      aria-label="Table filters and sorting"
      className={cn("flex w-full items-start justify-between gap-2 p-1", className)}
      {...props}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      <div className="flex items-center gap-2">
        <DataTableViewOptions table={table} align="end" />
      </div>
    </div>
  );
}
