// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/registry/bases/base/components/data-table/data-table-filter-menu.tsx at 5c2a102.
// nuqs is replaced by the `advanced` filter state of `useDataTable`; filters are chips you can
// edit (operator and value) and remove, and the command menu adds new ones.
import type { RowData } from "@tanstack/react-table";
import type { ComponentProps } from "react";

import { Button } from "@base-template/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@base-template/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@base-template/ui/components/popover";
import { cn } from "@base-template/ui/lib/utils";
import { ListFilterIcon, XIcon } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";

import type { DataTableAdvancedFilters } from "@/shared/hooks/use-data-table";
import type { DataTableInstance, FilterBuilderColumn } from "@/shared/lib/data-table/features";
import type { ColumnFilter } from "@/shared/lib/data-table/types";

import { useFilterDraft } from "@/shared/hooks/use-filter-draft";
import { useToggleShortcut } from "@/shared/hooks/use-toggle-shortcut";
import {
  createFilterWithValue,
  removeFilter,
  updateFilter,
} from "@/shared/lib/data-table/advanced";
import { getFilterBuilderColumns } from "@/shared/lib/data-table/features";

import { DataTableFilterChip } from "./data-table-filter-chip";
import { DataTableFilterValueSelector } from "./data-table-filter-value-selector";

type DataTableFilterMenuProps<TData extends RowData> = Omit<
  ComponentProps<typeof PopoverContent>,
  "children"
> & {
  table: DataTableInstance<TData>;
  /** `useDataTable(...).advanced`: the committed filters and their setters. */
  advanced: DataTableAdvancedFilters;
  disabled?: boolean;
  /** Opens the command menu on first render (stories, tests). */
  defaultOpen?: boolean;
};

/**
 * Command-palette alternative to the filter list: pick a field, then a value, and the filter
 * appears as a chip whose operator and value stay editable. Rows are written to the route
 * search (text and number edits debounced); all joined with the route's join operator.
 */
export function DataTableFilterMenu<TData extends RowData>({
  table,
  advanced,
  disabled,
  defaultOpen = false,
  className,
  ...props
}: DataTableFilterMenuProps<TData>) {
  const id = useId();
  const columns = getFilterBuilderColumns(table);
  const [open, setOpen] = useState(defaultOpen);
  const [selectedColumn, setSelectedColumn] = useState<FilterBuilderColumn | null>(null);
  const [inputValue, setInputValue] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { rows, update, clear } = useFilterDraft({
    committed: advanced.filters,
    commit: advanced.setFilters,
    reset: advanced.reset,
    debounceMs: advanced.debounceMs,
  });

  useToggleShortcut(
    "f",
    useCallback(() => setOpen((previous) => !previous), []),
  );

  const resetMenu = () => {
    setSelectedColumn(null);
    setInputValue("");
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      resetMenu();
    }
  };

  const onFilterAdd = (column: FilterBuilderColumn, value: string) => {
    if (value.trim() === "") {
      return;
    }
    update((previous) => [...previous, createFilterWithValue(column, previous, value)]);
    setOpen(false);
    resetMenu();
  };

  const onFilterUpdate = (
    filterId: string,
    updates: Partial<Omit<ColumnFilter, "filterId">>,
    options?: { debounce?: boolean },
  ) => update((previous) => updateFilter(previous, filterId, updates), options);

  const onFilterRemove = (filterId: string) => {
    update((previous) => removeFilter(previous, filterId));
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {rows.length > 0 ? (
        <div role="list" aria-label="Active filters" className="flex flex-wrap items-center gap-2">
          {rows.map((filter) => {
            const column = columns.find((candidate) => candidate.id === filter.id);
            return column ? (
              <DataTableFilterChip
                key={filter.filterId}
                filter={filter}
                column={column}
                itemId={`${id}-filter-${filter.filterId}`}
                onUpdate={onFilterUpdate}
                onRemove={onFilterRemove}
              />
            ) : null;
          })}
        </div>
      ) : null}
      {rows.length > 0 ? (
        <Button
          aria-label="Reset all filters"
          variant="outline"
          size="icon"
          className="size-8"
          onClick={clear}
        >
          <XIcon />
        </Button>
      ) : null}
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger
          render={
            <Button
              ref={triggerRef}
              aria-label="Open filter command menu"
              variant="outline"
              size={rows.length > 0 ? "icon" : "sm"}
              className={cn(rows.length > 0 && "size-8", "h-8 font-normal")}
              disabled={disabled}
            />
          }
        >
          <ListFilterIcon className="text-muted-foreground" />
          {rows.length > 0 ? null : "Filter"}
        </PopoverTrigger>
        <PopoverContent
          aria-label="Add filter"
          className={cn("w-full max-w-(--available-width) p-0", className)}
          {...props}
        >
          <Command loop className="[&_[cmdk-input-wrapper]_svg]:hidden">
            <CommandInput
              ref={inputRef}
              aria-label={selectedColumn ? `${selectedColumn.label} value` : "Search fields"}
              placeholder={selectedColumn ? selectedColumn.label : "Search fields..."}
              value={inputValue}
              onValueChange={setInputValue}
              onKeyDown={(event) => {
                if (
                  (event.key === "Backspace" || event.key === "Delete") &&
                  inputValue === "" &&
                  selectedColumn
                ) {
                  event.preventDefault();
                  setSelectedColumn(null);
                }
              }}
            />
            <CommandList>
              {selectedColumn ? (
                <>
                  {selectedColumn.meta?.options ? (
                    <CommandEmpty>No options found.</CommandEmpty>
                  ) : null}
                  <DataTableFilterValueSelector
                    column={selectedColumn}
                    value={inputValue}
                    onSelect={(value) => onFilterAdd(selectedColumn, value)}
                  />
                </>
              ) : (
                <>
                  <CommandEmpty>No fields found.</CommandEmpty>
                  <CommandGroup>
                    {columns.map((column) => (
                      <CommandItem
                        key={column.id}
                        value={column.id}
                        keywords={[column.label]}
                        onSelect={() => {
                          setSelectedColumn(column);
                          setInputValue("");
                          requestAnimationFrame(() => inputRef.current?.focus());
                        }}
                      >
                        {column.meta?.icon ? <column.meta.icon /> : null}
                        <span className="truncate">{column.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
