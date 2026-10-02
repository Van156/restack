// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: onFilterInputRender in data-table-filter-list.tsx at 5c2a102, with explicit labels.
import { Button } from "@base-template/ui/components/button";
import {
  Faceted,
  FacetedBadgeList,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedList,
  FacetedTrigger,
} from "@base-template/ui/components/faceted";
import { cn } from "@base-template/ui/lib/utils";

import type { FilterOperator } from "@/shared/lib/data-table/types";

import type { FilterEditorWithMetaProps } from "./data-table-filter-value-types";

const LIST_OPERATORS = new Set<FilterOperator>(["inArray", "notInArray"]);

/** Single select, or multi select for the list operators, over the column meta options. */
export function OptionsValue({
  filter,
  meta,
  label,
  inputId,
  onChange,
  className,
}: FilterEditorWithMetaProps) {
  const multiple = LIST_OPERATORS.has(filter.operator);
  const options = meta?.options ?? [];
  const selected = multiple
    ? Array.isArray(filter.value)
      ? filter.value
      : []
    : typeof filter.value === "string"
      ? filter.value
      : "";

  return (
    <Faceted
      multiple={multiple}
      value={selected}
      onValueChange={(next) => {
        if (multiple) {
          onChange({ value: Array.isArray(next) ? next : [] });
        } else {
          onChange({ value: typeof next === "string" ? next : "" });
        }
      }}
    >
      <FacetedTrigger
        render={
          <Button
            id={inputId}
            variant="outline"
            aria-label={`${label} filter value${multiple ? "s" : ""}`}
            className={cn("w-full rounded font-normal", className)}
          />
        }
      >
        <FacetedBadgeList
          options={options}
          placeholder={meta?.placeholder ?? `Select option${multiple ? "s" : ""}...`}
        />
      </FacetedTrigger>
      <FacetedContent aria-label={`${label} options`} className="w-50">
        <FacetedInput aria-label={`Search ${label} options`} placeholder="Search options..." />
        <FacetedList>
          <FacetedEmpty>No options found.</FacetedEmpty>
          <FacetedGroup>
            {options.map((option) => (
              <FacetedItem key={option.value} value={option.value}>
                {option.icon ? <option.icon /> : null}
                <span className="truncate">{option.label}</span>
                {option.count !== undefined ? (
                  <span className="ml-auto font-mono text-xs">{option.count}</span>
                ) : null}
              </FacetedItem>
            ))}
          </FacetedGroup>
        </FacetedList>
      </FacetedContent>
    </Faceted>
  );
}
