// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/registry/bases/base/components/data-table/data-table-filter-list.tsx at 5c2a102.
// nuqs is replaced by the `advanced` filter state of `useDataTable` (route search), rows are kept
// locally until they are complete, and every new row gets a generated `filterId`.
import type { RowData } from "@tanstack/react-table";
import type { ComponentProps } from "react";

import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@base-template/ui/components/popover";
import { Sortable, SortableContent, SortableOverlay } from "@base-template/ui/components/sortable";
import { cn } from "@base-template/ui/lib/utils";
import { ListFilterIcon } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";

import type { DataTableAdvancedFilters } from "@/shared/hooks/use-data-table";
import type { DataTableInstance, FilterBuilderColumn } from "@/shared/lib/data-table/features";
import type { ColumnFilter } from "@/shared/lib/data-table/types";

import { useFilterDraft } from "@/shared/hooks/use-filter-draft";
import { useToggleShortcut } from "@/shared/hooks/use-toggle-shortcut";
import {
  changeFilterColumn,
  createFilter,
  removeFilter,
  updateFilter,
} from "@/shared/lib/data-table/advanced";
import { getFilterBuilderColumns } from "@/shared/lib/data-table/features";

import { DataTableFilterItem } from "./data-table-filter-item";

type DataTableFilterListProps<TData extends RowData> = Omit<
  ComponentProps<typeof PopoverContent>,
  "children"
> & {
  table: DataTableInstance<TData>;
  /** `useDataTable(...).advanced`: the committed filters and their setters. */
  advanced: DataTableAdvancedFilters;
  disabled?: boolean;
  /** Opens the popover on first render (stories, tests). */
  defaultOpen?: boolean;
};

/**
 * Advanced filter builder: a popover with one row per filter (column, operator, value, and/or
 * join), drag or keyboard reorder, add, remove and reset. Rows live locally until complete;
 * complete ones are written to the route search (text and number edits debounced).
 */
export function DataTableFilterList<TData extends RowData>({
  table,
  advanced,
  disabled,
  defaultOpen = false,
  className,
  ...props
}: DataTableFilterListProps<TData>) {
  const id = useId();
  const labelId = useId();
  const descriptionId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const columns = getFilterBuilderColumns(table);
  const { filters: committed, joinOperator, setJoinOperator } = advanced;

  const { rows, update, clear } = useFilterDraft({
    committed,
    commit: advanced.setFilters,
    reset: advanced.reset,
    debounceMs: advanced.debounceMs,
  });

  useToggleShortcut(
    "f",
    useCallback(() => setOpen((previous) => !previous), []),
  );

  const onFilterAdd = () => {
    const column = columns[0];
    if (column) {
      update((previous) => [...previous, createFilter(column, previous)]);
    }
  };

  const onFilterUpdate = (
    filterId: string,
    updates: Partial<Omit<ColumnFilter, "filterId">>,
    options?: { debounce?: boolean },
  ) => update((previous) => updateFilter(previous, filterId, updates), options);

  const onFilterColumnChange = (filterId: string, column: FilterBuilderColumn) =>
    update((previous) =>
      previous.map((filter) =>
        filter.filterId === filterId ? changeFilterColumn(filter, column) : filter,
      ),
    );

  const onFilterRemove = (filterId: string) => {
    update((previous) => removeFilter(previous, filterId));
    requestAnimationFrame(() => addButtonRef.current?.focus());
  };

  return (
    <Sortable value={rows} onValueChange={update} getItemValue={(item) => item.filterId}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button variant="outline" className="font-normal" disabled={disabled} />}
        >
          <ListFilterIcon className="text-muted-foreground" />
          Filter
          {rows.length > 0 ? (
            <Badge
              variant="secondary"
              className="h-4.5 rounded-md px-1.5 font-mono text-[10px] font-normal"
            >
              {rows.length}
            </Badge>
          ) : null}
        </PopoverTrigger>
        <PopoverContent
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          className={cn(
            "flex w-full max-w-(--available-width) flex-col gap-3.5 p-4 sm:min-w-95",
            className,
          )}
          {...props}
        >
          <div className="flex flex-col gap-1">
            <h4 id={labelId} className="leading-none font-medium">
              {rows.length > 0 ? "Filters" : "No filters applied"}
            </h4>
            <p
              id={descriptionId}
              className={cn("text-sm text-muted-foreground", rows.length > 0 && "sr-only")}
            >
              {rows.length > 0
                ? "Modify filters to refine your rows."
                : "Add filters to refine your rows."}
            </p>
          </div>
          {rows.length > 0 ? (
            <SortableContent
              render={
                <div role="list" className="flex max-h-75 flex-col gap-2 overflow-y-auto p-1" />
              }
            >
              {rows.map((filter, index) => {
                const column = columns.find((candidate) => candidate.id === filter.id);
                return column ? (
                  <DataTableFilterItem
                    key={filter.filterId}
                    filter={filter}
                    column={column}
                    columns={columns}
                    index={index}
                    itemId={`${id}-filter-${filter.filterId}`}
                    joinOperator={joinOperator}
                    onJoinOperatorChange={setJoinOperator}
                    onUpdate={onFilterUpdate}
                    onColumnChange={onFilterColumnChange}
                    onRemove={onFilterRemove}
                  />
                ) : null;
              })}
            </SortableContent>
          ) : null}
          <div className="flex w-full items-center gap-2">
            <Button
              className="rounded"
              ref={addButtonRef}
              onClick={onFilterAdd}
              disabled={columns.length === 0}
            >
              Add filter
            </Button>
            {rows.length > 0 ? (
              <Button variant="outline" className="rounded" onClick={clear}>
                Reset filters
              </Button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
      <SortableOverlay>
        <div className="flex items-center gap-2">
          <div className="h-8 min-w-18 rounded-sm bg-primary/10" />
          <div className="h-8 w-32 rounded-sm bg-primary/10" />
          <div className="h-8 w-32 rounded-sm bg-primary/10" />
          <div className="h-8 min-w-36 flex-1 rounded-sm bg-primary/10" />
          <div className="size-8 shrink-0 rounded-sm bg-primary/10" />
          <div className="size-8 shrink-0 rounded-sm bg-primary/10" />
        </div>
      </SortableOverlay>
    </Sortable>
  );
}
