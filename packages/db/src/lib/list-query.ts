// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/lib/filter-columns.ts at 5c2a102, reworked to evaluate only the shared list vocabulary
// over an explicit column map, with variant-aware empty checks and the date day-window contract.
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  not,
  notIlike,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import type { Database } from "../index";
import { DAY_MS, escapeLikePattern, parseEpochValue, parseNumberValue } from "./list-values";
import { SERVER_OPERATORS } from "./list-vocabulary";
import type { FilterVariant, JoinOperator, ServerFilterOperator } from "./list-vocabulary";
import { toLimitOffset } from "./pagination";

/** Column id to Drizzle column: the only way a client-supplied id reaches SQL. */
export type ListColumns = Readonly<Record<string, AnyColumn>>;

export type ListSort<TId extends string = string> = { id: TId; desc: boolean };

export type ListFilter<TId extends string = string> = {
  id: TId;
  variant: FilterVariant;
  operator: ServerFilterOperator;
  /** Text, one option, or a list (`inArray`, `isBetween` ends). Dates are local-midnight epoch ms strings (docs/architecture/data-table.md#dates-and-time-zones). */
  value: string | string[];
  filterId?: string;
};

/** A parsed list input (`createListInput` in `@base-template/api`). */
export type ListQueryInput<TSortId extends string = string, TFilterId extends string = string> = {
  page: number;
  perPage: number;
  sort: ListSort<TSortId>[];
  filters: ListFilter<TFilterId>[];
  joinOperator: JoinOperator;
};

export type ListQuery = {
  where: SQL | undefined;
  orderBy: SQL[];
  limit: number;
  offset: number;
};

function getColumn(columns: ListColumns, id: string): AnyColumn {
  const column = Object.hasOwn(columns, id) ? columns[id] : undefined;
  if (!column) {
    throw new Error(`Unknown list column "${id}"`);
  }
  return column;
}

function asString(value: string | string[]): string {
  if (typeof value !== "string") {
    throw new Error("Expected a single value");
  }
  return value;
}

function asNumber(value: string | string[]): number {
  const text = asString(value);
  const parsed = parseNumberValue(text);
  if (parsed === undefined) {
    throw new Error(`Invalid number "${text}"`);
  }
  return parsed;
}

function asPair<T>(value: string | string[], parse: (item: string) => T): [T, T] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error("Expected two values");
  }
  return [parse(value[0] as string), parse(value[1] as string)];
}

function asList(value: string | string[]): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Expected a non-empty list");
  }
  return value;
}

/** Epoch ms of a local-midnight timestamp string, bounded so `epoch + DAY_MS` is a valid Date. */
function asEpoch(value: string | string[]): number {
  const text = asString(value);
  const epoch = parseEpochValue(text);
  if (epoch === undefined) {
    throw new Error(`Invalid timestamp "${text}"`);
  }
  return epoch;
}

/** Variant-aware emptiness (docs/architecture/data-table.md#empty-checks-per-variant). */
function isEmptyCondition(column: AnyColumn, variant: FilterVariant): SQL {
  switch (variant) {
    case "text":
    case "select":
      return or(isNull(column), sql`${column}::text = ''`) as SQL;
    case "multiSelect":
      return or(isNull(column), sql`${column}::text in ('', '[]', '{}')`) as SQL;
    default:
      return isNull(column);
  }
}

function numberCondition(
  column: AnyColumn,
  operator: ServerFilterOperator,
  value: string | string[],
): SQL | undefined {
  switch (operator) {
    case "eq":
      return eq(column, asNumber(value));
    case "ne":
      return ne(column, asNumber(value));
    case "lt":
      return lt(column, asNumber(value));
    case "lte":
      return lte(column, asNumber(value));
    case "gt":
      return gt(column, asNumber(value));
    case "gte":
      return gte(column, asNumber(value));
    case "isBetween": {
      const [from, to] = asPair(value, (item) => asNumber(item));
      return and(gte(column, from), lte(column, to));
    }
    default:
      return undefined;
  }
}

/** A filter on day D covers [D, D + 24h); see docs/architecture/data-table.md#dates-and-time-zones. */
function dateCondition(
  column: AnyColumn,
  operator: ServerFilterOperator,
  value: string | string[],
): SQL | undefined {
  switch (operator) {
    case "eq": {
      const start = asEpoch(value);
      return and(gte(column, new Date(start)), lt(column, new Date(start + DAY_MS)));
    }
    case "ne": {
      const start = asEpoch(value);
      return or(lt(column, new Date(start)), gte(column, new Date(start + DAY_MS)));
    }
    case "lt":
      return lt(column, new Date(asEpoch(value)));
    case "lte":
      return lt(column, new Date(asEpoch(value) + DAY_MS));
    case "gt":
      return gte(column, new Date(asEpoch(value) + DAY_MS));
    case "gte":
      return gte(column, new Date(asEpoch(value)));
    case "isBetween": {
      const [from, to] = asPair(value, (item) => asEpoch(item));
      return and(gte(column, new Date(from)), lt(column, new Date(to + DAY_MS)));
    }
    default:
      return undefined;
  }
}

function filterCondition(columns: ListColumns, filter: ListFilter): SQL {
  if (!(SERVER_OPERATORS as readonly string[]).includes(filter.operator)) {
    throw new Error(`Unsupported operator "${filter.operator}"`);
  }
  const column = getColumn(columns, filter.id);
  const { operator, value, variant } = filter;

  if (operator === "isEmpty") {
    return isEmptyCondition(column, variant);
  }
  if (operator === "isNotEmpty") {
    return not(isEmptyCondition(column, variant));
  }

  let condition: SQL | undefined;
  switch (variant) {
    case "number":
    case "range":
      condition = numberCondition(column, operator, value);
      break;
    case "date":
    case "dateRange":
      condition = dateCondition(column, operator, value);
      break;
    case "boolean": {
      const flag = asString(value);
      if (flag !== "true" && flag !== "false") {
        throw new Error(`Invalid boolean "${flag}"`);
      }
      condition =
        operator === "eq"
          ? eq(column, flag === "true")
          : operator === "ne"
            ? ne(column, flag === "true")
            : undefined;
      break;
    }
    case "multiSelect":
      condition =
        operator === "inArray"
          ? inArray(column, asList(value))
          : operator === "notInArray"
            ? notInArray(column, asList(value))
            : undefined;
      break;
    default:
      // text and select
      condition =
        operator === "iLike"
          ? ilike(column, `%${escapeLikePattern(asString(value))}%`)
          : operator === "notILike"
            ? notIlike(column, `%${escapeLikePattern(asString(value))}%`)
            : operator === "eq"
              ? eq(column, asString(value))
              : operator === "ne"
                ? ne(column, asString(value))
                : undefined;
  }

  if (!condition) {
    throw new Error(`Operator "${operator}" is not supported for ${variant} filters`);
  }
  return condition;
}

/** `where` for the filters joined with `joinOperator`; `undefined` when there are none. */
export function buildListWhere({
  columns,
  filters,
  joinOperator,
}: {
  columns: ListColumns;
  filters: readonly ListFilter[];
  joinOperator: JoinOperator;
}): SQL | undefined {
  if (filters.length === 0) {
    return undefined;
  }
  const conditions = filters.map((filter) => filterCondition(columns, filter));
  return joinOperator === "or" ? or(...conditions) : and(...conditions);
}

/**
 * `where`, `orderBy`, `limit` and `offset` for a parsed list input. Column ids resolve only
 * through `columns`; an id outside it throws. `tieBreakers` are appended to `orderBy` so paging
 * stays deterministic when the sorted values tie (e.g. the primary key).
 */
export function buildListQuery({
  columns,
  input,
  tieBreakers = [],
}: {
  columns: ListColumns;
  input: ListQueryInput;
  tieBreakers?: readonly (AnyColumn | SQL)[];
}): ListQuery {
  return {
    where: buildListWhere({
      columns,
      filters: input.filters,
      joinOperator: input.joinOperator,
    }),
    orderBy: [
      ...input.sort.map(({ id, desc: descending }) => {
        const column = getColumn(columns, id);
        return descending ? desc(column) : asc(column);
      }),
      ...tieBreakers.map((tieBreaker) => asc(tieBreaker)),
    ],
    ...toLimitOffset(input),
  };
}

/** `total` for a list: the row count of `table` under `where` (ignores limit/offset). */
export async function countListRows(
  db: Pick<Database, "select">,
  table: PgTable,
  where: SQL | undefined,
): Promise<number> {
  const [row] = await db.select({ total: count() }).from(table).where(where);
  return row?.total ?? 0;
}
