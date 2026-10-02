// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: onFilterInputRender in data-table-filter-list.tsx and data-table-range-filter.tsx at 5c2a102,
// with explicit labels, local open state and the `Calendar` from packages/ui.
import { cn } from "@base-template/ui/lib/utils";

import { operatorNeedsValue } from "@/shared/lib/data-table/config";
import type { DataTableColumnMeta, ColumnFilter } from "@/shared/lib/data-table/types";

import { BetweenValue } from "./data-table-filter-value-between";
import { BooleanValue } from "./data-table-filter-value-boolean";
import { DateValue } from "./data-table-filter-value-date";
import { InputValue } from "./data-table-filter-value-input";
import { OptionsValue } from "./data-table-filter-value-options";
import type { FilterValueChange } from "./data-table-filter-value-types";

export { DataTableFilterOperator } from "./data-table-filter-operator";
export type { FilterValueChange } from "./data-table-filter-value-types";

type DataTableFilterValueProps = {
  filter: ColumnFilter;
  /** Column meta (options, placeholder, range); `label` names the controls for assistive tech. */
  meta: DataTableColumnMeta | undefined;
  label: string;
  inputId: string;
  onChange: FilterValueChange;
  className?: string;
};

/**
 * The value control of a filter row, chosen by the column variant and the operator: a text or
 * number input, two ends for `isBetween`, a true/false select, a single or multi select, a date
 * or a date range. Operators without a value (`isEmpty`, `isNotEmpty`) show a placeholder.
 */
export function DataTableFilterValue({
  filter,
  meta,
  label,
  inputId,
  onChange,
  className,
}: DataTableFilterValueProps) {
  const { operator, variant } = filter;

  if (!operatorNeedsValue(operator)) {
    return (
      <div
        id={inputId}
        className={cn(
          "flex h-8 w-full items-center rounded border px-2.5 text-sm text-muted-foreground dark:bg-input/30",
          className,
        )}
      >
        No value needed
      </div>
    );
  }

  switch (variant) {
    case "boolean":
      return (
        <BooleanValue
          filter={filter}
          label={label}
          inputId={inputId}
          onChange={onChange}
          className={className}
        />
      );
    case "select":
    case "multiSelect":
      return (
        <OptionsValue
          filter={filter}
          meta={meta}
          label={label}
          inputId={inputId}
          onChange={onChange}
          className={className}
        />
      );
    case "date":
    case "dateRange":
      return (
        <DateValue
          filter={filter}
          label={label}
          inputId={inputId}
          onChange={onChange}
          className={className}
        />
      );
    default:
      break;
  }

  if (operator === "isBetween") {
    return (
      <BetweenValue
        filter={filter}
        meta={meta}
        label={label}
        inputId={inputId}
        onChange={onChange}
        className={className}
      />
    );
  }

  return (
    <InputValue
      filter={filter}
      meta={meta}
      label={label}
      inputId={inputId}
      onChange={onChange}
      className={className}
    />
  );
}
