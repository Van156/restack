// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: the filter row of src/registry/bases/base/components/data-table/data-table-filter-list.tsx at 5c2a102.
import type { KeyboardEvent } from "react";

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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@base-template/ui/components/select";
import { SortableItem, SortableItemHandle } from "@base-template/ui/components/sortable";
import { cn } from "@base-template/ui/lib/utils";
import { CheckIcon, ChevronsUpDownIcon, GripVerticalIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import type { DataTableAdvancedFilters } from "@/shared/hooks/use-data-table";
import type { FilterBuilderColumn } from "@/shared/lib/data-table/features";
import type { ColumnFilter } from "@/shared/lib/data-table/types";

import { dataTableConfig } from "@/shared/lib/data-table/config";
import { removeRowOnKey } from "@/shared/lib/data-table/remove-key";

import { DataTableFilterOperator } from "./data-table-filter-operator";
import { DataTableFilterValue } from "./data-table-filter-value";
import type { FilterValueChange } from "./data-table-filter-value-types";

type DataTableFilterItemProps = {
  filter: ColumnFilter;
  column: FilterBuilderColumn;
  columns: FilterBuilderColumn[];
  index: number;
  itemId: string;
  joinOperator: DataTableAdvancedFilters["joinOperator"];
  onJoinOperatorChange: DataTableAdvancedFilters["setJoinOperator"];
  onUpdate: (
    filterId: string,
    updates: Partial<Omit<ColumnFilter, "filterId">>,
    options?: { debounce?: boolean },
  ) => void;
  onColumnChange: (filterId: string, column: FilterBuilderColumn) => void;
  onRemove: (filterId: string) => void;
};

/** One row of the filter list; exported for render tests (the popover content does not render on the server). */
export function DataTableFilterItem({
  filter,
  column,
  columns,
  index,
  itemId,
  joinOperator,
  onJoinOperatorChange,
  onUpdate,
  onColumnChange,
  onRemove,
}: DataTableFilterItemProps) {
  const [fieldOpen, setFieldOpen] = useState(false);
  const inputId = `${itemId}-input`;

  const onChange: FilterValueChange = (updates, options) =>
    onUpdate(filter.filterId, updates, options);

  const onItemKeyDown = (event: KeyboardEvent<HTMLDivElement>) =>
    removeRowOnKey(event, { blocked: fieldOpen, onRemove: () => onRemove(filter.filterId) });

  return (
    <SortableItem
      value={filter.filterId}
      render={
        <div
          role="listitem"
          tabIndex={-1}
          className="flex items-center gap-2"
          onKeyDown={onItemKeyDown}
        />
      }
    >
      <div className="min-w-18 text-center">
        {index === 0 ? (
          <span className="text-sm text-muted-foreground">Where</span>
        ) : index === 1 ? (
          <Select
            value={joinOperator}
            onValueChange={(next) => {
              if (next !== null) {
                onJoinOperatorChange(next);
              }
            }}
          >
            <SelectTrigger size="sm" aria-label="Join operator" className="rounded lowercase">
              <SelectValue>{joinOperator}</SelectValue>
            </SelectTrigger>
            <SelectContent
              alignItemWithTrigger={false}
              className="min-w-(--anchor-width) lowercase"
            >
              <SelectGroup>
                {dataTableConfig.joinOperators.map((operator) => (
                  <SelectItem key={operator} value={operator}>
                    {operator}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm text-muted-foreground">{joinOperator}</span>
        )}
      </div>
      <Popover open={fieldOpen} onOpenChange={setFieldOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              aria-label={`Filter field, ${column.label}`}
              className="w-32 justify-between rounded font-normal"
            />
          }
        >
          <span className="truncate">{column.label}</span>
          <ChevronsUpDownIcon className="opacity-50" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-40 p-0">
          <Command>
            <CommandInput placeholder="Search fields..." aria-label="Search fields" />
            <CommandList>
              <CommandEmpty>No fields found.</CommandEmpty>
              <CommandGroup>
                {columns.map((candidate) => (
                  <CommandItem
                    key={candidate.id}
                    value={candidate.id}
                    onSelect={() => {
                      if (candidate.id !== filter.id) {
                        onColumnChange(filter.filterId, candidate);
                      }
                      setFieldOpen(false);
                    }}
                  >
                    <span className="truncate">{candidate.label}</span>
                    <CheckIcon
                      className={cn(
                        "ml-auto",
                        candidate.id === filter.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <DataTableFilterOperator
        filter={filter}
        label={column.label}
        onChange={onChange}
        className="w-32"
      />
      <div className="max-w-60 min-w-36 flex-1">
        <DataTableFilterValue
          filter={filter}
          meta={column.meta}
          label={column.label}
          inputId={inputId}
          onChange={onChange}
        />
      </div>
      <Button
        variant="outline"
        size="icon"
        aria-label={`Remove ${column.label} filter`}
        className="size-8 rounded"
        onClick={() => onRemove(filter.filterId)}
      >
        <Trash2Icon />
      </Button>
      <SortableItemHandle
        aria-label={`Reorder ${column.label} filter`}
        render={<Button variant="outline" size="icon" className="size-8 rounded" />}
      >
        <GripVerticalIcon />
      </SortableItemHandle>
    </SortableItem>
  );
}
