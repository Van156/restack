// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: onFilterInputRender in data-table-filter-list.tsx at 5c2a102, with explicit labels.
import { Input } from "@base-template/ui/components/input";
import { cn } from "@base-template/ui/lib/utils";

import type { FilterEditorWithMetaProps } from "./data-table-filter-value-types";

/** Text input, or a numeric one for the number and range variants; typing is debounced. */
export function InputValue({
  filter,
  meta,
  label,
  inputId,
  onChange,
  className,
}: FilterEditorWithMetaProps) {
  const isNumber = filter.variant === "number" || filter.variant === "range";
  return (
    <Input
      id={inputId}
      type={isNumber ? "number" : "text"}
      inputMode={isNumber ? "numeric" : undefined}
      aria-label={`${label} filter value`}
      placeholder={meta?.placeholder ?? "Enter a value..."}
      className={cn("h-8 w-full rounded", className)}
      value={typeof filter.value === "string" ? filter.value : ""}
      onChange={(event) => onChange({ value: event.target.value }, { debounce: true })}
    />
  );
}
