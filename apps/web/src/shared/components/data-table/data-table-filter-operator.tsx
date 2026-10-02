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

import type { ColumnFilter } from "@/shared/lib/data-table/types";

import { getBuilderOperators } from "@/shared/lib/data-table/advanced";

import type { FilterValueChange } from "./data-table-filter-value-types";

type DataTableFilterOperatorProps = {
  filter: ColumnFilter;
  label: string;
  onChange: FilterValueChange;
  className?: string;
};

/** Operator select of a filter row (the operators of its variant). */
export function DataTableFilterOperator({
  filter,
  label,
  onChange,
  className,
}: DataTableFilterOperatorProps) {
  const operators = getBuilderOperators(filter.variant);
  const current = operators.find((operator) => operator.value === filter.operator);
  return (
    <Select
      value={filter.operator}
      onValueChange={(next) => {
        if (next !== null) {
          onChange({ operator: next });
        }
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={`${label} filter operator`}
        className={cn("rounded", className)}
      >
        <SelectValue>
          <span className="truncate">{current?.label ?? filter.operator}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {operators.map((operator) => (
            <SelectItem key={operator.value} value={operator.value}>
              {operator.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
