// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/registry/bases/base/components/data-table/data-table-skeleton.tsx at 5c2a102.
import { Skeleton } from "@base-template/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";
import { cn } from "@base-template/ui/lib/utils";
import type { ComponentProps } from "react";

type DataTableSkeletonProps = ComponentProps<"div"> & {
  columnCount: number;
  rowCount?: number;
  filterCount?: number;
  cellWidths?: string[];
  withViewOptions?: boolean;
  withPagination?: boolean;
  shrinkZero?: boolean;
};

/** Loading placeholder with the shape of the table: toolbar, header, rows and pagination. */
export function DataTableSkeleton({
  columnCount,
  rowCount = 10,
  filterCount = 0,
  cellWidths = ["auto"],
  withViewOptions = true,
  withPagination = true,
  shrinkZero = false,
  className,
  ...props
}: DataTableSkeletonProps) {
  const widths = Array.from(
    { length: columnCount },
    (_, index) => cellWidths[index % cellWidths.length] ?? "auto",
  );
  const cellStyle = (index: number) => ({
    width: widths[index],
    minWidth: shrinkZero ? widths[index] : "auto",
  });

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading table"
      className={cn("flex w-full flex-col gap-2.5 overflow-auto", className)}
      {...props}
    >
      <div className="flex w-full items-center justify-between gap-2 overflow-auto p-1">
        <div className="flex flex-1 items-center gap-2">
          {Array.from({ length: filterCount }, (_, index) => (
            <Skeleton key={index} className="h-8 w-18 border-dashed" />
          ))}
        </div>
        {withViewOptions ? <Skeleton className="ml-auto h-8 w-18" /> : null}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {widths.map((_, index) => (
                <TableHead key={index} style={cellStyle(index)}>
                  <span className="sr-only">Loading column</span>
                  <Skeleton className="h-6 w-full" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rowCount }, (_, row) => (
              <TableRow key={row} className="hover:bg-transparent">
                {widths.map((_, index) => (
                  <TableCell key={index} style={cellStyle(index)}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {withPagination ? (
        <div className="flex w-full items-center justify-between gap-4 overflow-auto p-1 sm:gap-8">
          <Skeleton className="h-8 w-40 shrink-0" />
          <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-18" />
            </div>
            <Skeleton className="h-8 w-20" />
            <div className="flex items-center gap-2">
              <Skeleton className="hidden size-8 lg:block" />
              <Skeleton className="size-8" />
              <Skeleton className="size-8" />
              <Skeleton className="hidden size-8 lg:block" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
