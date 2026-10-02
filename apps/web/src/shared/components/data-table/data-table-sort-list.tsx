// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/registry/bases/base/components/data-table/data-table-sort-list.tsx at 5c2a102.
// Sorting is read from and written to the table (`useDataTable` maps it to the route `sort`).
import type { RowData } from "@tanstack/react-table";

import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@base-template/ui/components/popover";
import { Sortable, SortableContent, SortableOverlay } from "@base-template/ui/components/sortable";
import { cn } from "@base-template/ui/lib/utils";
import { ArrowDownUpIcon } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";

import type { DataTableInstance } from "@/shared/lib/data-table/features";
import type { ColumnSort } from "@/shared/lib/data-table/types";

import { useToggleShortcut } from "@/shared/hooks/use-toggle-shortcut";
import {
  addSort,
  getAvailableSortColumns,
  removeSort,
  updateSort,
} from "@/shared/lib/data-table/advanced";
import { getSortBuilderColumns } from "@/shared/lib/data-table/features";
import { MAX_SORT_ITEMS } from "@/shared/lib/data-table/search";

import { DataTableSortItem } from "./data-table-sort-item";

type DataTableSortListProps<TData extends RowData> = {
  table: DataTableInstance<TData>;
  disabled?: boolean;
  /** Opens the popover on first render (stories, tests). */
  defaultOpen?: boolean;
  className?: string;
};

/**
 * Multi-column sort builder: add (up to `MAX_SORT_ITEMS`), change column and direction, remove,
 * drag or keyboard reorder, and reset to the default sort.
 */
export function DataTableSortList<TData extends RowData>({
  table,
  disabled,
  defaultOpen = false,
  className,
}: DataTableSortListProps<TData>) {
  const labelId = useId();
  const descriptionId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const sorting: ColumnSort[] = table.state.sorting;
  const columns = getSortBuilderColumns(table);
  const available = getAvailableSortColumns(columns, sorting);
  const labels = new Map(columns.map((column) => [column.id, column.label]));

  useToggleShortcut(
    "s",
    useCallback(() => setOpen((previous) => !previous), []),
  );

  const onSortRemove = (sortId: string) => {
    table.setSorting(removeSort(sorting, sortId));
    requestAnimationFrame(() => addButtonRef.current?.focus());
  };

  return (
    <Sortable
      value={sorting}
      onValueChange={(next) => table.setSorting(next)}
      getItemValue={(item) => item.id}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button variant="outline" className="font-normal" disabled={disabled} />}
        >
          <ArrowDownUpIcon className="text-muted-foreground" />
          Sort
          {sorting.length > 0 ? (
            <Badge
              variant="secondary"
              className="h-4.5 rounded-md px-1.5 font-mono text-[10px] font-normal"
            >
              {sorting.length}
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
        >
          <div className="flex flex-col gap-1">
            <h4 id={labelId} className="leading-none font-medium">
              {sorting.length > 0 ? "Sort by" : "No sorting applied"}
            </h4>
            <p
              id={descriptionId}
              className={cn("text-sm text-muted-foreground", sorting.length > 0 && "sr-only")}
            >
              {sorting.length > 0
                ? "Modify sorting to organize your rows."
                : "Add sorting to organize your rows."}
            </p>
          </div>
          {sorting.length > 0 ? (
            <SortableContent
              render={
                <div role="list" className="flex max-h-75 flex-col gap-2 overflow-y-auto p-1" />
              }
            >
              {sorting.map((sort) => (
                <DataTableSortItem
                  key={sort.id}
                  sort={sort}
                  label={labels.get(sort.id) ?? sort.id}
                  fieldOptions={[
                    ...columns.filter((column) => column.id === sort.id),
                    ...available,
                  ]}
                  onUpdate={(sortId, updates) =>
                    table.setSorting(updateSort(sorting, sortId, updates))
                  }
                  onRemove={onSortRemove}
                />
              ))}
            </SortableContent>
          ) : null}
          <div className="flex w-full items-center gap-2">
            <Button
              className="rounded"
              ref={addButtonRef}
              onClick={() => table.setSorting(addSort(sorting, columns))}
              disabled={available.length === 0 || sorting.length >= MAX_SORT_ITEMS}
            >
              Add sort
            </Button>
            {sorting.length > 0 ? (
              <Button
                variant="outline"
                className="rounded"
                onClick={() => table.setSorting(table.initialState.sorting)}
              >
                Reset sorting
              </Button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
      <SortableOverlay>
        <div className="flex items-center gap-2">
          <div className="h-8 w-45 rounded-sm bg-primary/10" />
          <div className="h-8 w-24 rounded-sm bg-primary/10" />
          <div className="size-8 shrink-0 rounded-sm bg-primary/10" />
          <div className="size-8 shrink-0 rounded-sm bg-primary/10" />
        </div>
      </SortableOverlay>
    </Sortable>
  );
}
