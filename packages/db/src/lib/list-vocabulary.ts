// Canonical filter vocabulary shared by the web table (labels, builders), the API list input
// (validation) and the Drizzle adapter (evaluation). Pure data: no drizzle, pg or zod import,
// so the browser can bundle it. Derived from tablecn (https://github.com/sadmann7/tablecn),
// MIT License, (c) 2024 Sadman Sakib (src/config/data-table.ts at 5c2a102).

export const FILTER_VARIANTS = [
  "text",
  "number",
  "range",
  "date",
  "dateRange",
  "boolean",
  "select",
  "multiSelect",
] as const;

export const FILTER_OPERATORS = [
  "iLike",
  "notILike",
  "eq",
  "ne",
  "inArray",
  "notInArray",
  "isEmpty",
  "isNotEmpty",
  "lt",
  "lte",
  "gt",
  "gte",
  "isBetween",
  "isRelativeToToday",
] as const;

export const JOIN_OPERATORS = ["and", "or"] as const;

/** Most sort items a list accepts (spec §6.4). */
export const MAX_SORT_ITEMS = 3;

/** Most filters a list accepts. */
export const MAX_FILTERS = 10;

/** Longest single string value a filter may carry. */
export const MAX_FILTER_VALUE_LENGTH = 256;

export type FilterVariant = (typeof FILTER_VARIANTS)[number];
export type FilterOperator = (typeof FILTER_OPERATORS)[number];
export type JoinOperator = (typeof JOIN_OPERATORS)[number];

/** Operators the server evaluates: the vocabulary minus `isRelativeToToday`, whose value has no defined shape yet. */
export type ServerFilterOperator = Exclude<FilterOperator, "isRelativeToToday">;
export const SERVER_OPERATORS: readonly ServerFilterOperator[] = FILTER_OPERATORS.filter(
  (operator): operator is ServerFilterOperator => operator !== "isRelativeToToday",
);

const NUMERIC_OPERATORS = [
  "eq",
  "ne",
  "lt",
  "lte",
  "gt",
  "gte",
  "isBetween",
  "isEmpty",
  "isNotEmpty",
] as const satisfies readonly FilterOperator[];

const DATE_OPERATORS = [
  "eq",
  "ne",
  "lt",
  "gt",
  "lte",
  "gte",
  "isBetween",
  "isRelativeToToday",
  "isEmpty",
  "isNotEmpty",
] as const satisfies readonly FilterOperator[];

/** Operators each variant supports, in builder order (the first is the default). */
export const OPERATORS_BY_VARIANT: Record<FilterVariant, readonly FilterOperator[]> = {
  text: ["iLike", "notILike", "eq", "ne", "isEmpty", "isNotEmpty"],
  number: NUMERIC_OPERATORS,
  range: NUMERIC_OPERATORS,
  date: DATE_OPERATORS,
  dateRange: DATE_OPERATORS,
  boolean: ["eq", "ne"],
  select: ["eq", "ne", "isEmpty", "isNotEmpty"],
  multiSelect: ["inArray", "notInArray", "isEmpty", "isNotEmpty"],
};

/** Operators of `variant` the server evaluates (everything but `isRelativeToToday`). */
export function getServerOperators(variant: FilterVariant): readonly ServerFilterOperator[] {
  return OPERATORS_BY_VARIANT[variant].filter((operator): operator is ServerFilterOperator =>
    (SERVER_OPERATORS as readonly FilterOperator[]).includes(operator),
  );
}
