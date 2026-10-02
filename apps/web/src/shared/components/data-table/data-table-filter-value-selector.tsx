// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: the value picker of src/registry/bases/base/components/data-table/data-table-filter-menu.tsx at 5c2a102.
import { Calendar } from "@base-template/ui/components/calendar";
import { CommandGroup, CommandItem } from "@base-template/ui/components/command";
import { TextIcon } from "lucide-react";

import type { FilterBuilderColumn } from "@/shared/lib/data-table/features";

/** Command-menu value step for the picked column, by variant. */
export function DataTableFilterValueSelector({
  column,
  value,
  onSelect,
}: {
  column: FilterBuilderColumn;
  value: string;
  onSelect: (value: string) => void;
}) {
  switch (column.variant) {
    case "boolean":
      return (
        <CommandGroup>
          <CommandItem value="true" onSelect={() => onSelect("true")}>
            True
          </CommandItem>
          <CommandItem value="false" onSelect={() => onSelect("false")}>
            False
          </CommandItem>
        </CommandGroup>
      );
    case "select":
    case "multiSelect":
      return (
        <CommandGroup>
          {column.meta?.options?.map((option) => (
            <CommandItem
              key={option.value}
              value={option.value}
              keywords={[option.label]}
              onSelect={() => onSelect(option.value)}
            >
              {option.icon ? <option.icon /> : null}
              <span className="truncate">{option.label}</span>
              {option.count !== undefined ? (
                <span className="ml-auto font-mono text-xs">{option.count}</span>
              ) : null}
            </CommandItem>
          ))}
        </CommandGroup>
      );
    case "date":
    case "dateRange":
      return (
        <Calendar
          aria-label={`Select ${column.label} date`}
          autoFocus
          captionLayout="dropdown"
          mode="single"
          onSelect={(date) => {
            if (date) {
              onSelect(String(date.getTime()));
            }
          }}
        />
      );
    default: {
      const isNumber = column.variant === "number" || column.variant === "range";
      const disabled = value.trim() === "" || (isNumber && !Number.isFinite(Number(value)));
      return (
        <CommandGroup>
          <CommandItem value={value} onSelect={() => onSelect(value)} disabled={disabled}>
            <TextIcon />
            <span className="truncate">
              {disabled ? "Type to add filter..." : `Filter by "${value}"`}
            </span>
          </CommandItem>
        </CommandGroup>
      );
    }
  }
}
