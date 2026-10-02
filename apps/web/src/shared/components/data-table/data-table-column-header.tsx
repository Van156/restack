// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/registry/bases/base/components/data-table/data-table-column-header.tsx at 5c2a102.
import type { Column, RowData } from "@tanstack/react-table";
import type { ComponentProps } from "react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@base-template/ui/components/dropdown-menu";
import { cn } from "@base-template/ui/lib/utils";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  EyeOffIcon,
  XIcon,
} from "lucide-react";

import type { DataTableFeatures } from "@/shared/lib/data-table/features";

type DataTableColumnHeaderProps<TData extends RowData, TValue> = Omit<
  ComponentProps<typeof DropdownMenuTrigger>,
  "className"
> & {
  className?: string;
  column: Column<DataTableFeatures, TData, TValue>;
  label: string;
};

const itemClassName =
  "relative pr-8 pl-2 [&_svg]:text-muted-foreground [&>span:first-child]:right-2 [&>span:first-child]:left-auto";

/**
 * Header cell content with a sort (asc, desc, reset) and hide menu. The `aria-sort` attribute
 * belongs on the `th` and is set by `DataTable`; this component shows the direction visually.
 */
export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  label,
  className,
  ...props
}: DataTableColumnHeaderProps<TData, TValue>) {
  const canSort = column.getCanSort();
  const canHide = column.getCanHide();

  if (!canSort && !canHide) {
    return <div className={className}>{label}</div>;
  }

  const sorted = column.getIsSorted();
  const SortIcon = sorted === "desc" ? ChevronDownIcon : sorted === "asc" ? ChevronUpIcon : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "-ml-1.5 flex h-8 items-center gap-1.5 rounded-md px-2 py-1.5 outline-none hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring data-popup-open:bg-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
          className,
        )}
        {...props}
      >
        {label}
        {canSort ? SortIcon ? <SortIcon /> : <ChevronsUpDownIcon /> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-28">
        {canSort ? (
          <>
            <DropdownMenuCheckboxItem
              className={itemClassName}
              checked={sorted === "asc"}
              onClick={() => column.toggleSorting(false)}
            >
              <ChevronUpIcon />
              Asc
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className={itemClassName}
              checked={sorted === "desc"}
              onClick={() => column.toggleSorting(true)}
            >
              <ChevronDownIcon />
              Desc
            </DropdownMenuCheckboxItem>
            {sorted ? (
              <DropdownMenuItem
                className="pl-2 [&_svg]:text-muted-foreground"
                onClick={() => column.clearSorting()}
              >
                <XIcon />
                Reset
              </DropdownMenuItem>
            ) : null}
          </>
        ) : null}
        {canHide ? (
          <DropdownMenuCheckboxItem
            className={itemClassName}
            checked={!column.getIsVisible()}
            onClick={() => column.toggleVisibility(false)}
          >
            <EyeOffIcon />
            Hide
          </DropdownMenuCheckboxItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
