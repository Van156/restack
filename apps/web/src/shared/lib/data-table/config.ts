// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/lib/data-table-utils.ts at 5c2a102 (dataTableConfig, operator helpers).
import {
  FILTER_OPERATORS,
  FILTER_VARIANTS,
  JOIN_OPERATORS,
} from "@base-template/api/lib/list-vocabulary";
import type {
  FilterOperator,
  FilterVariant,
  JoinOperator,
} from "@base-template/api/lib/list-vocabulary";

// The variant, operator and join vocabulary is canonical in `@base-template/db` (shared with the
// server list input and the Drizzle adapter); only labels and builder grouping live here.
export type { FilterOperator, FilterVariant, JoinOperator };

export const dataTableConfig = {
  textOperators: [
    { label: "Contains", value: "iLike" as const },
    { label: "Does not contain", value: "notILike" as const },
    { label: "Is", value: "eq" as const },
    { label: "Is not", value: "ne" as const },
    { label: "Is empty", value: "isEmpty" as const },
    { label: "Is not empty", value: "isNotEmpty" as const },
  ],
  numericOperators: [
    { label: "Is", value: "eq" as const },
    { label: "Is not", value: "ne" as const },
    { label: "Is less than", value: "lt" as const },
    { label: "Is less than or equal to", value: "lte" as const },
    { label: "Is greater than", value: "gt" as const },
    { label: "Is greater than or equal to", value: "gte" as const },
    { label: "Is between", value: "isBetween" as const },
    { label: "Is empty", value: "isEmpty" as const },
    { label: "Is not empty", value: "isNotEmpty" as const },
  ],
  dateOperators: [
    { label: "Is", value: "eq" as const },
    { label: "Is not", value: "ne" as const },
    { label: "Is before", value: "lt" as const },
    { label: "Is after", value: "gt" as const },
    { label: "Is on or before", value: "lte" as const },
    { label: "Is on or after", value: "gte" as const },
    { label: "Is between", value: "isBetween" as const },
    { label: "Is relative to today", value: "isRelativeToToday" as const },
    { label: "Is empty", value: "isEmpty" as const },
    { label: "Is not empty", value: "isNotEmpty" as const },
  ],
  selectOperators: [
    { label: "Is", value: "eq" as const },
    { label: "Is not", value: "ne" as const },
    { label: "Is empty", value: "isEmpty" as const },
    { label: "Is not empty", value: "isNotEmpty" as const },
  ],
  multiSelectOperators: [
    { label: "Has any of", value: "inArray" as const },
    { label: "Has none of", value: "notInArray" as const },
    { label: "Is empty", value: "isEmpty" as const },
    { label: "Is not empty", value: "isNotEmpty" as const },
  ],
  booleanOperators: [
    { label: "Is", value: "eq" as const },
    { label: "Is not", value: "ne" as const },
  ],
  sortOrders: [
    { label: "Asc", value: "asc" as const },
    { label: "Desc", value: "desc" as const },
  ],
  filterVariants: FILTER_VARIANTS,
  operators: FILTER_OPERATORS,
  joinOperators: JOIN_OPERATORS,
};

export type DataTableConfig = typeof dataTableConfig;

const operatorsByVariant: Record<FilterVariant, { label: string; value: FilterOperator }[]> = {
  text: dataTableConfig.textOperators,
  number: dataTableConfig.numericOperators,
  range: dataTableConfig.numericOperators,
  date: dataTableConfig.dateOperators,
  dateRange: dataTableConfig.dateOperators,
  boolean: dataTableConfig.booleanOperators,
  select: dataTableConfig.selectOperators,
  multiSelect: dataTableConfig.multiSelectOperators,
};

/** Operators a column of `variant` supports; unknown variants fall back to the text operators. */
export function getFilterOperators(variant: FilterVariant) {
  return Object.hasOwn(operatorsByVariant, variant)
    ? operatorsByVariant[variant]
    : dataTableConfig.textOperators;
}

/** The operator a new filter starts with: the first one of the variant. */
export function getDefaultFilterOperator(variant: FilterVariant): FilterOperator {
  return getFilterOperators(variant)[0]?.value ?? (variant === "text" ? "iLike" : "eq");
}

/** Whether `operator` is one of the operators `variant` supports. */
export function isOperatorValidForVariant(
  variant: FilterVariant,
  operator: FilterOperator,
): boolean {
  return getFilterOperators(variant).some((candidate) => candidate.value === operator);
}

/** `isEmpty` and `isNotEmpty` are complete without a value. */
export function operatorNeedsValue(operator: FilterOperator): boolean {
  return operator !== "isEmpty" && operator !== "isNotEmpty";
}
