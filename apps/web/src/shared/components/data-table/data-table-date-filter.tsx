// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/registry/bases/base/components/data-table/data-table-date-filter.tsx at 5c2a102;
// the Radix calendar import is replaced by the Base UI `Calendar` from packages/ui.
import type { Column, RowData } from "@tanstack/react-table";

import { Button } from "@base-template/ui/components/button";
import { Calendar } from "@base-template/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@base-template/ui/components/popover";
import { Separator } from "@base-template/ui/components/separator";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import type { DataTableFeatures } from "@/shared/lib/data-table/features";

import { dateRangeToFilterValue, parseTimestamp } from "@/shared/lib/data-table/date";

import { DataTableFilterClear } from "./data-table-filter-clear";

type DataTableDateFilterProps<TData extends RowData> = {
  column: Column<DataTableFeatures, TData>;
  title: string;
  /** A date range (`[from, to]` timestamps) instead of a single date. */
  multiple?: boolean;
};

function formatDate(date: Date | undefined) {
  return date ? format(date, "LLL dd, y") : "";
}

/** Date (`dateRange` variant: date range) filter; the value is a timestamp or `[from, to]` timestamps. */
export function DataTableDateFilter<TData extends RowData>({
  column,
  title,
  multiple = false,
}: DataTableDateFilterProps<TData>) {
  const value = column.getFilterValue();
  const list = Array.isArray(value) ? value : [value];
  const from = parseTimestamp(list[0]);
  const to = multiple ? parseTimestamp(list[1]) : undefined;
  const hasValue = Boolean(from ?? to);
  const clear = () => column.setFilterValue(undefined);

  const text = multiple
    ? from && to
      ? `${formatDate(from)} - ${formatDate(to)}`
      : formatDate(from ?? to)
    : formatDate(from);

  return (
    <div className="inline-flex items-center">
      <Popover>
        <PopoverTrigger
          render={<Button variant="outline" size="sm" className="border-dashed font-normal" />}
        >
          <CalendarIcon />
          <span>{title}</span>
          {hasValue ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-0.5 data-[orientation=vertical]:h-4"
              />
              <span>{text}</span>
            </>
          ) : null}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          {multiple ? (
            <Calendar
              autoFocus
              captionLayout="dropdown"
              mode="range"
              selected={{ from, to }}
              onSelect={(range) => column.setFilterValue(dateRangeToFilterValue(range))}
            />
          ) : (
            <Calendar
              autoFocus
              captionLayout="dropdown"
              mode="single"
              selected={from}
              onSelect={(date) => column.setFilterValue(date?.getTime())}
            />
          )}
        </PopoverContent>
      </Popover>
      {hasValue ? <DataTableFilterClear title={title} onClear={clear} /> : null}
    </div>
  );
}
