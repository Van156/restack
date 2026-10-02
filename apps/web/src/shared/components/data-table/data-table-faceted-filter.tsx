// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/registry/bases/base/components/data-table/data-table-faceted-filter.tsx at 5c2a102.
import type { Column, RowData } from "@tanstack/react-table";

import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import {
  Faceted,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedList,
  FacetedSeparator,
  FacetedTrigger,
} from "@base-template/ui/components/faceted";
import { Separator } from "@base-template/ui/components/separator";
import { PlusCircleIcon } from "lucide-react";

import type { DataTableFeatures } from "@/shared/lib/data-table/features";
import type { Option } from "@/shared/lib/data-table/types";

import { DataTableFilterClear } from "./data-table-filter-clear";

type DataTableFacetedFilterProps<TData extends RowData, TValue> = {
  column: Column<DataTableFeatures, TData, TValue>;
  title: string;
  options: Option[];
  multiple?: boolean;
};

function toSelectedValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return typeof value === "string" && value !== "" ? [value] : [];
}

/** Single or multi select filter; option counts come from `meta.options` (the server owns them). */
export function DataTableFacetedFilter<TData extends RowData, TValue>({
  column,
  title,
  options,
  multiple = false,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const selected = toSelectedValues(column.getFilterValue());
  const clear = () => column.setFilterValue(undefined);

  return (
    <div className="inline-flex items-center">
      <Faceted
        multiple={multiple}
        // An explicit empty value keeps the single select controlled when nothing is selected.
        value={multiple ? selected : (selected[0] ?? "")}
        onValueChange={(next) => {
          const values = toSelectedValues(next);
          column.setFilterValue(multiple ? (values.length > 0 ? values : undefined) : values[0]);
        }}
      >
        <FacetedTrigger
          render={<Button variant="outline" size="sm" className="border-dashed font-normal" />}
        >
          <PlusCircleIcon />
          {title}
          {selected.length > 0 ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-0.5 data-[orientation=vertical]:h-4"
              />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                {selected.length}
              </Badge>
              <span className="hidden items-center gap-1 lg:flex">
                {selected.length > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {selected.length} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selected.includes(option.value))
                    .map((option) => (
                      <Badge
                        key={option.value}
                        variant="secondary"
                        className="rounded-sm px-1 font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </span>
            </>
          ) : null}
        </FacetedTrigger>
        <FacetedContent aria-label={`${title} options`}>
          <FacetedInput placeholder={title} aria-label={`Search ${title}`} />
          <FacetedList>
            <FacetedEmpty>No results found.</FacetedEmpty>
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
            {selected.length > 0 ? (
              <>
                <FacetedSeparator />
                <FacetedGroup>
                  <FacetedItem
                    value="__clear__"
                    onSelect={clear}
                    className="justify-center text-center"
                  >
                    Clear filters
                  </FacetedItem>
                </FacetedGroup>
              </>
            ) : null}
          </FacetedList>
        </FacetedContent>
      </Faceted>
      {selected.length > 0 ? <DataTableFilterClear title={title} onClear={clear} /> : null}
    </div>
  );
}
