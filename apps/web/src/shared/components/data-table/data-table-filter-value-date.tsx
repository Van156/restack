// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: data-table-date-filter.tsx at 5c2a102, with explicit labels and local open state.
import { Button } from "@base-template/ui/components/button";
import { Calendar } from "@base-template/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@base-template/ui/components/popover";
import { cn } from "@base-template/ui/lib/utils";
import { CalendarIcon } from "lucide-react";

import {
  dateRangeToFilterValue,
  formatFilterDate,
  parseTimestamp,
} from "@/shared/lib/data-table/date";

import type { FilterEditorProps } from "./data-table-filter-value-types";

/** Calendar popover: one day, or a range for `isBetween`. */
export function DateValue({ filter, label, inputId, onChange, className }: FilterEditorProps) {
  const list = Array.isArray(filter.value) ? filter.value : [filter.value];
  const from = parseTimestamp(list[0]);
  const to = parseTimestamp(list[1]);
  const between = filter.operator === "isBetween";
  const text = between
    ? from && to
      ? `${formatFilterDate(from)} - ${formatFilterDate(to)}`
      : formatFilterDate(from ?? to)
    : formatFilterDate(from);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            id={inputId}
            variant="outline"
            aria-label={`${label} date filter`}
            className={cn(
              "w-full justify-start rounded text-left font-normal",
              !text && "text-muted-foreground",
              className,
            )}
          />
        }
      >
        <CalendarIcon />
        <span className="truncate">{text || (between ? "Pick a date range" : "Pick a date")}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        {between ? (
          <Calendar
            aria-label={`Select ${label} date range`}
            autoFocus
            captionLayout="dropdown"
            mode="range"
            selected={{ from, to }}
            onSelect={(range) => {
              const next = dateRangeToFilterValue(range);
              onChange({ value: [String(next?.[0] ?? ""), String(next?.[1] ?? "")] });
            }}
          />
        ) : (
          <Calendar
            aria-label={`Select ${label} date`}
            autoFocus
            captionLayout="dropdown"
            mode="single"
            selected={from}
            onSelect={(date) => onChange({ value: date ? String(date.getTime()) : "" })}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
