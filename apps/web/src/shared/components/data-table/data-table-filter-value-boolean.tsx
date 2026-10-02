// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: onFilterInputRender in data-table-filter-list.tsx at 5c2a102, with explicit labels.
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@base-template/ui/components/select";
import { cn } from "@base-template/ui/lib/utils";

import type { FilterEditorProps } from "./data-table-filter-value-types";

/** True/false select for boolean columns; an empty value reads as `true`. */
export function BooleanValue({ filter, label, inputId, onChange, className }: FilterEditorProps) {
  const value = typeof filter.value === "string" && filter.value !== "" ? filter.value : "true";
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next !== null) {
          onChange({ value: next });
        }
      }}
    >
      <SelectTrigger
        id={inputId}
        size="sm"
        aria-label={`${label} boolean filter`}
        className={cn("w-full rounded", className)}
      >
        <SelectValue>{value === "true" ? "True" : "False"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="true">True</SelectItem>
          <SelectItem value="false">False</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
