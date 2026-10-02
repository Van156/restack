// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: the sort row of src/registry/bases/base/components/data-table/data-table-sort-list.tsx at 5c2a102.
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
import { ChevronsUpDownIcon, GripVerticalIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import type { ColumnSort } from "@/shared/lib/data-table/types";

import { dataTableConfig } from "@/shared/lib/data-table/config";
import { removeRowOnKey } from "@/shared/lib/data-table/remove-key";

type DataTableSortItemProps = {
  sort: ColumnSort;
  label: string;
  /** The item's own column first, then the columns no other item uses. */
  fieldOptions: { id: string; label: string }[];
  onUpdate: (sortId: string, updates: Partial<ColumnSort>) => void;
  onRemove: (sortId: string) => void;
};

/** One row of the sort list; exported for render tests (the popover content does not render on the server). */
export function DataTableSortItem({
  sort,
  label,
  fieldOptions,
  onUpdate,
  onRemove,
}: DataTableSortItemProps) {
  const [fieldOpen, setFieldOpen] = useState(false);

  const onItemKeyDown = (event: KeyboardEvent<HTMLDivElement>) =>
    removeRowOnKey(event, { blocked: fieldOpen, onRemove: () => onRemove(sort.id) });

  return (
    <SortableItem
      value={sort.id}
      render={
        <div
          role="listitem"
          tabIndex={-1}
          className="flex items-center gap-2"
          onKeyDown={onItemKeyDown}
        />
      }
    >
      <Popover open={fieldOpen} onOpenChange={setFieldOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              aria-label={`Sort field, ${label}`}
              className="w-44 justify-between rounded font-normal"
            />
          }
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDownIcon className="opacity-50" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--anchor-width) p-0">
          <Command>
            <CommandInput placeholder="Search fields..." aria-label="Search fields" />
            <CommandList>
              <CommandEmpty>No fields found.</CommandEmpty>
              <CommandGroup>
                {fieldOptions.map((column) => (
                  <CommandItem
                    key={column.id}
                    value={column.id}
                    onSelect={(value) => {
                      if (value !== sort.id) {
                        onUpdate(sort.id, { id: value });
                      }
                      setFieldOpen(false);
                    }}
                  >
                    <span className="truncate">{column.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Select
        value={sort.desc ? "desc" : "asc"}
        onValueChange={(value) => {
          if (value !== null) {
            onUpdate(sort.id, { desc: value === "desc" });
          }
        }}
      >
        <SelectTrigger size="sm" aria-label={`${label} sort direction`} className="w-24 rounded">
          <SelectValue>{sort.desc ? "Desc" : "Asc"}</SelectValue>
        </SelectTrigger>
        <SelectContent className="min-w-(--anchor-width)">
          <SelectGroup>
            {dataTableConfig.sortOrders.map((order) => (
              <SelectItem key={order.value} value={order.value}>
                {order.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        aria-label={`Remove ${label} sort`}
        className="size-8 shrink-0 rounded"
        onClick={() => onRemove(sort.id)}
      >
        <Trash2Icon />
      </Button>
      <SortableItemHandle
        aria-label={`Reorder ${label} sort`}
        render={<Button variant="outline" size="icon" className="size-8 shrink-0 rounded" />}
      >
        <GripVerticalIcon />
      </SortableItemHandle>
    </SortableItem>
  );
}
