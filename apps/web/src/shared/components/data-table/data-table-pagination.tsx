// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/registry/bases/base/components/data-table/data-table-pagination.tsx at 5c2a102.
import type { RowData } from "@tanstack/react-table";
import { useId, type ComponentProps } from "react";

import { Button } from "@base-template/ui/components/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@base-template/ui/components/select";
import { cn } from "@base-template/ui/lib/utils";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";

import type { DataTableInstance } from "@/shared/lib/data-table/features";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

type DataTablePaginationProps<TData extends RowData> = ComponentProps<"div"> & {
  table: DataTableInstance<TData>;
  pageSizeOptions?: number[];
  /** Disables every control, e.g. while a page fetch is in flight. */
  disabled?: boolean;
};

/** Selected count, page size select and first/previous/next/last buttons for a server-paginated table. */
export function DataTablePagination<TData extends RowData>({
  table,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  disabled = false,
  className,
  ...props
}: DataTablePaginationProps<TData>) {
  const labelId = useId();
  const { pageIndex, pageSize } = table.state.pagination;
  const selectedCount = Object.keys(table.state.rowSelection).length;
  const pageCount = Math.max(table.getPageCount(), 1);
  const canPrevious = !disabled && table.getCanPreviousPage();
  const canNext = !disabled && table.getCanNextPage();
  const sizes = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);

  return (
    <div
      className={cn(
        "flex w-full flex-col-reverse items-center justify-between gap-4 overflow-auto p-1 sm:flex-row sm:gap-8",
        className,
      )}
      {...props}
    >
      <div className="flex-1 text-sm whitespace-nowrap text-muted-foreground">
        {selectedCount} {selectedCount === 1 ? "row" : "rows"} selected.
      </div>
      <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8">
        <div className="flex items-center gap-2">
          <p id={labelId} className="text-sm font-medium whitespace-nowrap">
            Rows per page
          </p>
          <Select
            value={String(pageSize)}
            disabled={disabled}
            onValueChange={(value) => {
              if (value !== null) {
                table.setPageSize(Number(value));
              }
            }}
          >
            <SelectTrigger size="sm" className="w-18" aria-labelledby={labelId}>
              <SelectValue>{pageSize}</SelectValue>
            </SelectTrigger>
            <SelectContent side="top">
              <SelectGroup>
                {sizes.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-center text-sm font-medium">
          Page {pageIndex + 1} of {pageCount}
        </div>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Go to first page"
            variant="outline"
            size="icon-sm"
            className="hidden lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!canPrevious}
          >
            <ChevronsLeftIcon />
          </Button>
          <Button
            aria-label="Go to previous page"
            variant="outline"
            size="icon-sm"
            onClick={() => table.previousPage()}
            disabled={!canPrevious}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            aria-label="Go to next page"
            variant="outline"
            size="icon-sm"
            onClick={() => table.nextPage()}
            disabled={!canNext}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            aria-label="Go to last page"
            variant="outline"
            size="icon-sm"
            className="hidden lg:flex"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!canNext}
          >
            <ChevronsRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
