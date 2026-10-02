import type { ListSort } from "@base-template/db/lib/list-query";
import { parseEpochValue, parseNumberValue } from "@base-template/db/lib/list-values";
import {
  getServerOperators,
  JOIN_OPERATORS,
  MAX_FILTER_VALUE_LENGTH,
  MAX_FILTERS,
  MAX_SORT_ITEMS,
  SERVER_OPERATORS,
} from "@base-template/db/lib/list-vocabulary";
import type { FilterVariant, ServerFilterOperator } from "@base-template/db/lib/list-vocabulary";
import { DEFAULT_PAGE_SIZE, getMaxPage, MAX_PAGE_SIZE } from "@base-template/db/lib/pagination";
import { z } from "zod";

export { toLimitOffset } from "@base-template/db/lib/pagination";

/** Most items a multi-select filter may carry. */
const MAX_LIST_ITEMS = 100;

export type {
  ListFilter,
  ListQueryInput as ListInput,
  ListSort,
} from "@base-template/db/lib/list-query";

/** A filterable column: a bare variant, or a variant with constraints. */
export type FilterColumnConfig =
  | FilterVariant
  | {
      variant: FilterVariant;
      /** `number`/`range` only: reject fractional values. */
      integer?: boolean;
      /** `select`/`multiSelect` only: the values the column may be filtered by. Omitted accepts any string; an empty list is a configuration error. */
      options?: readonly string[];
    };

export type ListInputConfig<TSortId extends string, TFilterId extends string> = {
  /** Column ids the list may be sorted by. Anything else is rejected. */
  sortableColumns: readonly TSortId[];
  /** Column ids the list may be filtered by, each with the one variant its filters must declare. */
  filterableColumns: Record<TFilterId, FilterColumnConfig>;
  /** Sort applied when the client sends none. Defaults to unsorted. */
  defaultSort?: readonly ListSort<TSortId>[];
};

type NormalizedColumn = {
  variant: FilterVariant;
  integer: boolean;
  options: ReadonlySet<string> | undefined;
};

/** A zod enum of `values`, or `never` when there are none (an empty allowlist rejects everything). */
function enumOf<TValue extends string>(values: readonly TValue[]) {
  const [first, ...rest] = values;
  return first === undefined ? z.never() : z.enum([first, ...rest]);
}

function normalizeColumn(id: string, config: FilterColumnConfig): NormalizedColumn {
  const { variant, integer, options } =
    typeof config === "string"
      ? { variant: config, integer: undefined, options: undefined }
      : config;
  if (integer && variant !== "number" && variant !== "range") {
    throw new Error(`Column "${id}": integer applies to number and range filters only`);
  }
  if (options?.length === 0) {
    throw new Error(`Column "${id}": options must not be empty (omit them to accept any string)`);
  }
  if (options && variant !== "select" && variant !== "multiSelect") {
    throw new Error(`Column "${id}": options apply to select and multiSelect filters only`);
  }
  return { variant, integer: Boolean(integer), options: options ? new Set(options) : undefined };
}

function isPair(value: unknown, check: (item: string) => boolean): boolean {
  return Array.isArray(value) && value.length === 2 && value.every((item) => check(item));
}

/** Whether `value` has the shape `operator` needs on `column` (the adapter relies on it). */
function isValueValid(
  column: NormalizedColumn,
  operator: ServerFilterOperator,
  value: string | string[],
): boolean {
  if (operator === "isEmpty" || operator === "isNotEmpty") {
    return true;
  }
  const single = typeof value === "string" && value !== "" ? value : undefined;
  const isNumber = (item: string) =>
    parseNumberValue(item, { integer: column.integer }) !== undefined;
  const isOption = (item: string) => item !== "" && (column.options?.has(item) ?? true);
  switch (column.variant) {
    case "number":
    case "range":
      return operator === "isBetween"
        ? isPair(value, isNumber)
        : single !== undefined && isNumber(single);
    case "date":
    case "dateRange":
      return operator === "isBetween"
        ? isPair(value, (item) => parseEpochValue(item) !== undefined)
        : single !== undefined && parseEpochValue(single) !== undefined;
    case "boolean":
      return value === "true" || value === "false";
    case "multiSelect":
      return Array.isArray(value) && value.length > 0 && value.every(isOption);
    case "select":
      return single !== undefined && isOption(single);
    default:
      return single !== undefined;
  }
}

/**
 * The shared list input of every Drizzle-backed list (spec §6.4). Column ids come only from the
 * allowlists; each filter must declare the column's variant and an operator that variant supports,
 * with a value of the right shape. Unknown ids and operators are rejected by zod, never interpolated.
 *
 * ```ts
 * const input = createListInput({
 *   sortableColumns: ["createdAt", "action"],
 *   filterableColumns: { action: "text", createdAt: "date" },
 *   defaultSort: [{ id: "createdAt", desc: true }],
 * });
 * ```
 */
export function createListInput<TSortId extends string, TFilterId extends string>(
  config: ListInputConfig<TSortId, TFilterId>,
) {
  const filterIds = Object.keys(config.filterableColumns) as TFilterId[];
  const columns = new Map(
    filterIds.map((id) => [id as string, normalizeColumn(id, config.filterableColumns[id])]),
  );
  const variants = [...new Set([...columns.values()].map((column) => column.variant))];

  const sortItem = z.strictObject({ id: enumOf(config.sortableColumns), desc: z.boolean() });

  const filterItem = z
    .strictObject({
      id: enumOf(filterIds),
      variant: enumOf(variants),
      operator: z.enum(SERVER_OPERATORS),
      value: z.union([
        z.string().max(MAX_FILTER_VALUE_LENGTH),
        z.array(z.string().max(MAX_FILTER_VALUE_LENGTH)).max(MAX_LIST_ITEMS),
      ]),
      filterId: z.string().min(1).max(MAX_FILTER_VALUE_LENGTH).optional(),
    })
    .superRefine((item, ctx) => {
      const column = columns.get(item.id);
      if (!column) {
        return;
      }
      if (item.variant !== column.variant) {
        ctx.addIssue({
          code: "custom",
          path: ["variant"],
          message: `Column "${item.id}" is filtered as ${column.variant}, not ${item.variant}`,
        });
        return;
      }
      if (!getServerOperators(item.variant).includes(item.operator)) {
        ctx.addIssue({
          code: "custom",
          path: ["operator"],
          message: `Operator "${item.operator}" is not supported for ${item.variant} filters`,
        });
        return;
      }
      if (!isValueValid(column, item.operator, item.value)) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: `Invalid value for ${item.variant} ${item.operator}`,
        });
      }
    });

  return z
    .object({
      page: z.number().int().min(1).default(1),
      perPage: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
      sort: z
        .array(sortItem)
        .max(MAX_SORT_ITEMS)
        .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
          message: "Sort ids must be unique",
        })
        .default(() => (config.defaultSort ?? []).map((item) => ({ ...item }))),
      filters: z.array(filterItem).max(MAX_FILTERS).default([]),
      joinOperator: z.enum(JOIN_OPERATORS).default("and"),
    })
    .superRefine((input, ctx) => {
      if (input.page > getMaxPage(input.perPage)) {
        ctx.addIssue({
          code: "custom",
          path: ["page"],
          message: `Page ${input.page} is beyond the deepest page (${getMaxPage(input.perPage)}) for ${input.perPage} rows per page`,
        });
      }
    });
}
