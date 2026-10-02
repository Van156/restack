// In-memory stand-in for the server used by stories and render tests: evaluates the table search
// (simple per-column keys, advanced filters with a join operator, multi sort, paging) over rows.
import type { DataTableSearch } from "@/shared/lib/data-table/search";
import type { ColumnFilter, ColumnSort } from "@/shared/lib/data-table/types";

import { parseTimestamp } from "@/shared/lib/data-table/date";
import { parseRangeValue } from "@/shared/lib/data-table/range";

import type { MemberRow } from "./data-table-fixtures";

type MemberSearch = DataTableSearch<"name" | "email" | "role" | "status" | "score" | "joinedAt">;

const DAY_MS = 24 * 60 * 60 * 1000;

function toList(value: ColumnFilter["value"]): string[] {
  return Array.isArray(value) ? value : [value];
}

function compare(left: string | number, right: string | number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function matchesNumber(actual: number, filter: ColumnFilter): boolean {
  const target = Number(toList(filter.value)[0]);
  switch (filter.operator) {
    case "eq":
      return actual === target;
    case "ne":
      return actual !== target;
    case "lt":
      return actual < target;
    case "lte":
      return actual <= target;
    case "gt":
      return actual > target;
    case "gte":
      return actual >= target;
    case "isBetween": {
      const range = parseRangeValue(filter.value);
      return range ? actual >= range[0] && actual <= range[1] : true;
    }
    default:
      return true;
  }
}

function matchesDate(actual: number, filter: ColumnFilter): boolean {
  const list = toList(filter.value);
  const from = parseTimestamp(list[0])?.getTime();
  const to = parseTimestamp(list[1])?.getTime();
  switch (filter.operator) {
    case "eq":
      return from !== undefined && actual >= from && actual < from + DAY_MS;
    case "ne":
      return from === undefined || actual < from || actual >= from + DAY_MS;
    case "lt":
      return from === undefined || actual < from;
    case "lte":
      return from === undefined || actual < from + DAY_MS;
    case "gt":
      return from === undefined || actual >= from + DAY_MS;
    case "gte":
      return from === undefined || actual >= from;
    case "isBetween":
      return from === undefined || to === undefined || (actual >= from && actual < to + DAY_MS);
    default:
      return true;
  }
}

function matchesText(actual: string, filter: ColumnFilter): boolean {
  const target = String(toList(filter.value)[0] ?? "");
  const lowered = actual.toLowerCase();
  switch (filter.operator) {
    case "iLike":
      return lowered.includes(target.toLowerCase());
    case "notILike":
      return !lowered.includes(target.toLowerCase());
    case "eq":
      return actual === target;
    case "ne":
      return actual !== target;
    default:
      return true;
  }
}

/** Whether `row` satisfies one advanced filter (the operators the builders offer). */
export function matchesFilter(row: MemberRow, filter: ColumnFilter): boolean {
  const actual = row[filter.id as keyof MemberRow];
  if (filter.operator === "isEmpty") {
    return actual === undefined || actual === "";
  }
  if (filter.operator === "isNotEmpty") {
    return actual !== undefined && actual !== "";
  }
  if (filter.operator === "inArray") {
    return toList(filter.value).includes(String(actual));
  }
  if (filter.operator === "notInArray") {
    return !toList(filter.value).includes(String(actual));
  }
  if (typeof actual === "number") {
    return filter.variant === "date" || filter.variant === "dateRange"
      ? matchesDate(actual, filter)
      : matchesNumber(actual, filter);
  }
  return matchesText(String(actual), filter);
}

function sortRows(rows: MemberRow[], sort: readonly ColumnSort[]): MemberRow[] {
  if (sort.length === 0) {
    return rows;
  }
  return [...rows].sort((a, b) => {
    for (const { id, desc } of sort) {
      const order = compare(a[id as keyof MemberRow], b[id as keyof MemberRow]);
      if (order !== 0) {
        return desc ? -order : order;
      }
    }
    return 0;
  });
}

/** Filters, sorts and pages `rows` by the table search. */
export function queryMembers(rows: MemberRow[], search: MemberSearch) {
  const roles = search.role?.split(",").filter(Boolean) ?? [];
  const score = parseRangeValue(search.score?.split(","));
  const from = parseTimestamp(search.joinedAt?.split(",")[0]);
  const to = parseTimestamp(search.joinedAt?.split(",")[1]);
  const simple = rows.filter(
    (row) =>
      (!search.name || row.name.toLowerCase().includes(search.name.toLowerCase())) &&
      (roles.length === 0 || roles.includes(row.role)) &&
      (!search.status || row.status === search.status) &&
      (!score || (row.score >= score[0] && row.score <= score[1])) &&
      (!from || row.joinedAt >= from.getTime()) &&
      (!to || row.joinedAt <= to.getTime()),
  );
  const filtered =
    search.filters.length === 0
      ? simple
      : simple.filter((row) =>
          search.joinOperator === "or"
            ? search.filters.some((filter) => matchesFilter(row, filter))
            : search.filters.every((filter) => matchesFilter(row, filter)),
        );
  const sorted = sortRows(filtered, search.sort);
  const start = (search.page - 1) * search.perPage;
  return {
    rows: sorted.slice(start, start + search.perPage),
    total: filtered.length,
  };
}
