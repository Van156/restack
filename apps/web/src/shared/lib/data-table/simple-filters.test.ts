import { describe, expect, test } from "bun:test";

import {
  isBoundedStringFilter,
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "./simple-filters";

const columns = { email: "text", role: "select", tags: "multiSelect" } as const;

describe("simpleSearchToFilters", () => {
  test("turns each per-column key into a filter with the variant's default operator", () => {
    expect(
      simpleSearchToFilters({ email: "ada", role: "admin", tags: "a,b", page: 2 }, columns),
    ).toEqual([
      { id: "email", value: "ada", variant: "text", operator: "iLike", filterId: "simple-email" },
      { id: "role", value: "admin", variant: "select", operator: "eq", filterId: "simple-role" },
      {
        id: "tags",
        value: ["a", "b"],
        variant: "multiSelect",
        operator: "inArray",
        filterId: "simple-tags",
      },
    ]);
  });

  test("ignores blank, missing and non-string values and keys that are not columns", () => {
    expect(
      simpleSearchToFilters({ email: "", role: undefined, other: "x", tags: 3 }, columns),
    ).toEqual([]);
  });
});

describe("normalizeSimpleSearch", () => {
  const accepts = (filter: { id: string; value: string | string[] }) => filter.value !== "bad";

  test("drops keys the server would reject and resets the advanced keys", () => {
    const search = {
      page: 2,
      email: "ada",
      role: "bad",
      filters: [{ id: "email" }],
      joinOperator: "or",
    };
    expect(normalizeSimpleSearch(search, columns, accepts as never) as unknown).toEqual({
      page: 2,
      email: "ada",
      filters: [],
      joinOperator: "and",
    });
  });
});

describe("isBoundedStringFilter", () => {
  const filter = (value: string | string[]) => ({
    id: "role",
    value,
    variant: "select" as const,
    operator: "eq" as const,
    filterId: "f",
  });

  test("accepts a string up to the list input's length cap", () => {
    expect(isBoundedStringFilter(filter("admin"))).toBe(true);
    expect(isBoundedStringFilter(filter("x".repeat(256)))).toBe(true);
  });

  test("rejects a longer string and a list value", () => {
    expect(isBoundedStringFilter(filter("x".repeat(257)))).toBe(false);
    expect(isBoundedStringFilter(filter(["a", "b"]))).toBe(false);
  });
});
