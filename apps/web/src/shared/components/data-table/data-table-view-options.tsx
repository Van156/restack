// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/registry/bases/base/components/data-table/data-table-view-options.tsx at 5c2a102.
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
import { Settings2Icon } from "lucide-react";

import type { DataTableInstance } from "@/shared/lib/data-table/features";

type DataTableViewOptionsProps<TData extends RowData> = ComponentProps<typeof PopoverContent> & {
  table: DataTableInstance<TData>;
  disabled?: boolean;
};

/** Popover with a searchable list of the columns that can be hidden. */
export function DataTableViewOptions<TData extends RowData>({
  table,
  disabled,
  className,
  ...props
}: DataTableViewOptionsProps<TData>) {
  const columns = table
    .getAllColumns()
    .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide());

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="ml-auto font-normal" disabled={disabled} />
        }
      >
        <Settings2Icon className="text-muted-foreground" />
        View
      </PopoverTrigger>
      <PopoverContent className={cn("w-44 p-0", className)} {...props}>
        <Command>
          <CommandInput placeholder="Search columns..." aria-label="Search columns" />
          <CommandList>
            <CommandEmpty>No columns found.</CommandEmpty>
            <CommandGroup>
              {columns.map((column) => {
                const isVisible = column.getIsVisible();
                return (
                  <CommandItem
                    key={column.id}
                    data-checked={isVisible}
                    onSelect={() => column.toggleVisibility(!isVisible)}
                  >
                    <span className="truncate">{column.columnDef.meta?.label ?? column.id}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
