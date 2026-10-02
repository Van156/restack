import { describe, expect, test } from "bun:test";

import type { ColumnFilter } from "@/shared/lib/data-table/types";

import { memberRows, memberSearchSchema } from "./data-table-fixtures";
import { matchesFilter, queryMembers } from "./data-table-fake-server";

const filter = (overrides: Partial<ColumnFilter>): ColumnFilter => ({
  id: "name",
  value: "",
  variant: "text",
  operator: "iLike",
  filterId: "filter-1",
  ...overrides,
});

const ada = memberRows[0]!; // admin, active, score 92, joined 2024-01-15
const alan = memberRows[2]!; // viewer, suspended, score 55, joined 2024-05-21

describe("matchesFilter", () => {
  test("text operators", () => {
    expect(matchesFilter(ada, filter({ value: "LOVE" }))).toBe(true);
    expect(matchesFilter(ada, filter({ operator: "notILike", value: "love" }))).toBe(false);
    expect(matchesFilter(ada, filter({ operator: "eq", value: "Ada Lovelace" }))).toBe(true);
    expect(matchesFilter(ada, filter({ operator: "ne", value: "Ada Lovelace" }))).toBe(false);
    expect(matchesFilter(ada, filter({ operator: "isNotEmpty" }))).toBe(true);
    expect(matchesFilter(ada, filter({ operator: "isEmpty" }))).toBe(false);
  });

  test("number operators", () => {
    const score = (operator: ColumnFilter["operator"], value: ColumnFilter["value"]) =>
      filter({ id: "score", variant: "number", operator, value });
    expect(matchesFilter(ada, score("gt", "90"))).toBe(true);
    expect(matchesFilter(ada, score("lt", "90"))).toBe(false);
    expect(matchesFilter(ada, score("gte", "92"))).toBe(true);
    expect(matchesFilter(ada, score("lte", "91"))).toBe(false);
    expect(matchesFilter(ada, score("eq", "92"))).toBe(true);
    expect(matchesFilter(ada, score("ne", "92"))).toBe(false);
    expect(matchesFilter(ada, score("isBetween", ["90", "95"]))).toBe(true);
    expect(matchesFilter(alan, score("isBetween", ["90", "95"]))).toBe(false);
  });

  test("select and multi select operators", () => {
    const status = (operator: ColumnFilter["operator"], value: string) =>
      filter({ id: "status", variant: "select", operator, value });
    expect(matchesFilter(ada, status("eq", "active"))).toBe(true);
    expect(matchesFilter(ada, status("ne", "active"))).toBe(false);
    const role = (operator: ColumnFilter["operator"], value: string[]) =>
      filter({ id: "role", variant: "multiSelect", operator, value });
    expect(matchesFilter(ada, role("inArray", ["admin", "viewer"]))).toBe(true);
    expect(matchesFilter(ada, role("notInArray", ["admin"]))).toBe(false);
    expect(matchesFilter(alan, role("notInArray", ["admin"]))).toBe(true);
  });

  test("date operators compare timestamps", () => {
    const joined = (operator: ColumnFilter["operator"], value: ColumnFilter["value"]) =>
      filter({ id: "joinedAt", variant: "date", operator, value });
    const march = String(Date.UTC(2024, 2, 1));
    expect(matchesFilter(ada, joined("lt", march))).toBe(true);
    expect(matchesFilter(ada, joined("gt", march))).toBe(false);
    expect(matchesFilter(alan, joined("isBetween", [march, String(Date.UTC(2024, 5, 1))]))).toBe(
      true,
    );
    expect(matchesFilter(ada, joined("isBetween", [march, String(Date.UTC(2024, 5, 1))]))).toBe(
      false,
    );
  });
});

describe("queryMembers (advanced)", () => {
  const search = (input: unknown) => memberSearchSchema.parse(input);
  const ids = (input: unknown) => queryMembers(memberRows, search(input)).rows.map((row) => row.id);

  test("and joins every filter", () => {
    const filters = [
      filter({ id: "status", variant: "select", operator: "eq", value: "active" }),
      filter({ filterId: "filter-2", id: "score", variant: "number", operator: "gt", value: "90" }),
    ];
    expect(ids({ filters })).toEqual(["m1", "m5"]);
  });

  test("or joins any filter", () => {
    const filters = [
      filter({ id: "status", variant: "select", operator: "eq", value: "suspended" }),
      filter({ filterId: "filter-2", id: "score", variant: "number", operator: "gt", value: "95" }),
    ];
    expect(ids({ filters, joinOperator: "or", sort: [{ id: "name", desc: false }] })).toEqual([
      "m3",
      "m5",
    ]);
  });

  test("no filters returns everything", () => {
    expect(queryMembers(memberRows, search({})).total).toBe(memberRows.length);
  });

  test("sorts by several columns in order", () => {
    const sorted = queryMembers(
      memberRows,
      search({
        sort: [
          { id: "status", desc: false },
          { id: "score", desc: true },
        ],
      }),
    ).rows.map((row) => row.id);
    // active (score desc): m5 97, m1 92, m4 84, m2 78; then suspended: m3
    expect(sorted).toEqual(["m5", "m1", "m4", "m2", "m3"]);
  });

  test("the second sort column breaks ties of the first", () => {
    const sorted = queryMembers(
      memberRows,
      search({
        sort: [
          { id: "role", desc: false },
          { id: "score", desc: false },
        ],
      }),
    ).rows.map((row) => row.id);
    // admin: m1 92, m5 97; member: m2 78, m4 84; viewer: m3
    expect(sorted).toEqual(["m1", "m5", "m2", "m4", "m3"]);
  });

  test("still pages after filtering", () => {
    const result = queryMembers(memberRows, search({ page: 2, perPage: 2 }));
    expect(result.total).toBe(5);
    expect(result.rows).toHaveLength(2);
  });
});
