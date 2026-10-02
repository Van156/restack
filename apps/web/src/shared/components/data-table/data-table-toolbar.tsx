// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/registry/bases/base/components/data-table/data-table-toolbar.tsx at 5c2a102.
import type { Column, RowData } from "@tanstack/react-table";
import type { ComponentProps } from "react";

import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import { cn } from "@base-template/ui/lib/utils";
import { XIcon } from "lucide-react";

import type { DataTableFeatures, DataTableInstance } from "@/shared/lib/data-table/features";

import { getColumnFilterValue } from "@/shared/lib/data-table/features";

import { DataTableDateFilter } from "./data-table-date-filter";
import { DataTableFacetedFilter } from "./data-table-faceted-filter";
import { DataTableSliderFilter } from "./data-table-slider-filter";
import { DataTableViewOptions } from "./data-table-view-options";

type DataTableToolbarProps<TData extends RowData> = ComponentProps<"div"> & {
  table: DataTableInstance<TData>;
};

/**
 * One filter widget per filterable column (chosen by `meta.variant`), a reset button when
 * filters are active, `children` (page actions) and the view options.
 */
export function DataTableToolbar<TData extends RowData>({
  table,
  children,
  className,
  ...props
}: DataTableToolbarProps<TData>) {
  const columns = table.getAllColumns().filter((column) => column.getCanFilter());
  const isFiltered = table.state.columnFilters.length > 0;

  return (
    <div
      role="toolbar"
      aria-orientation="horizontal"
      aria-label="Table filters"
      className={cn("flex w-full items-start justify-between gap-2 p-1", className)}
      {...props}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {columns.map((column) => (
          <DataTableToolbarFilter key={column.id} table={table} column={column} />
        ))}
        {isFiltered ? (
          <Button
            aria-label="Reset filters"
            variant="outline"
            size="sm"
            className="border-dashed"
            onClick={() => table.resetColumnFilters()}
          >
            <XIcon />
            Reset
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {children}
        <DataTableViewOptions table={table} align="end" />
      </div>
    </div>
  );
}

function readInputValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return Array.isArray(value) ? value.join(",") : "";
}

function DataTableToolbarFilter<TData extends RowData>({
  table,
  column,
}: {
  table: DataTableInstance<TData>;
  column: Column<DataTableFeatures, TData>;
}) {
  const meta = column.columnDef.meta;
  const title = meta?.label ?? column.id;

  switch (meta?.variant) {
    case "text":
    case "number": {
      const isNumber = meta.variant === "number";
      return (
        <div className="relative">
          <Input
            type={isNumber ? "number" : "text"}
            inputMode={isNumber ? "numeric" : undefined}
            aria-label={`Filter ${title}`}
            placeholder={meta.placeholder ?? title}
            value={readInputValue(getColumnFilterValue(table, column.id))}
            onChange={(event) => column.setFilterValue(event.target.value)}
            className={cn(
              "h-8",
              isNumber ? "w-30" : "w-40 lg:w-56",
              isNumber && meta.unit && "pr-8",
            )}
          />
          {isNumber && meta.unit ? (
            <span className="absolute top-0 right-0 bottom-0 flex items-center rounded-r-md bg-accent px-2 text-sm text-muted-foreground">
              {meta.unit}
            </span>
          ) : null}
        </div>
      );
    }
    case "range":
      return <DataTableSliderFilter column={column} title={title} />;
    case "date":
    case "dateRange":
      return (
        <DataTableDateFilter
          column={column}
          title={title}
          multiple={meta.variant === "dateRange"}
        />
      );
    case "select":
    case "multiSelect":
      return (
        <DataTableFacetedFilter
          column={column}
          title={title}
          options={meta.options ?? []}
          multiple={meta.variant === "multiSelect"}
        />
      );
    default:
      return null;
  }
}
