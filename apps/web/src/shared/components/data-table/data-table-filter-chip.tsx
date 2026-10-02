// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: the filter chip of src/registry/bases/base/components/data-table/data-table-filter-menu.tsx at 5c2a102.
import { Button } from "@base-template/ui/components/button";
import { XIcon } from "lucide-react";

import type { FilterBuilderColumn } from "@/shared/lib/data-table/features";
import type { ColumnFilter } from "@/shared/lib/data-table/types";

import {
  DataTableFilterOperator,
  DataTableFilterValue,
  type FilterValueChange,
} from "./data-table-filter-value";

export type DataTableFilterChipProps = {
  filter: ColumnFilter;
  column: FilterBuilderColumn;
  itemId: string;
  onUpdate: (
    filterId: string,
    updates: Partial<Omit<ColumnFilter, "filterId">>,
    options?: { debounce?: boolean },
  ) => void;
  onRemove: (filterId: string) => void;
};

/** Editable chip for one active filter: operator, value and a remove button. */
export function DataTableFilterChip({
  filter,
  column,
  itemId,
  onUpdate,
  onRemove,
}: DataTableFilterChipProps) {
  const onChange: FilterValueChange = (updates, options) =>
    onUpdate(filter.filterId, updates, options);

  return (
    <div
      role="listitem"
      className="flex items-center gap-1 rounded-md border bg-background p-0.5 pl-2"
    >
      <span className="flex items-center gap-1 text-sm font-medium">
        {column.meta?.icon ? <column.meta.icon className="size-3.5 text-muted-foreground" /> : null}
        {column.label}
      </span>
      <DataTableFilterOperator
        filter={filter}
        label={column.label}
        onChange={onChange}
        className="h-7 w-auto border-0 px-2 shadow-none"
      />
      <div className="w-40">
        <DataTableFilterValue
          filter={filter}
          meta={column.meta}
          label={column.label}
          inputId={`${itemId}-input`}
          onChange={onChange}
          className="h-7"
        />
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Remove ${column.label} filter`}
        onClick={() => onRemove(filter.filterId)}
      >
        <XIcon />
      </Button>
    </div>
  );
}
