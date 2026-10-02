import { buildListQuery } from "@base-template/db/lib/list-query";
import { auditLog } from "@base-template/db/schema/audit";
import { getMaxPage, MAX_OFFSET, MAX_PAGE_SIZE } from "@base-template/db/lib/pagination";
import { MAX_FILTERS, MAX_SORT_ITEMS } from "@base-template/db/lib/list-vocabulary";
import { describe, expect, test } from "bun:test";

import { createListInput, toLimitOffset } from "./list-input";

const listInput = createListInput({
  sortableColumns: ["createdAt", "action"],
  filterableColumns: {
    action: "text",
    amount: "number",
    createdAt: "date",
    active: "boolean",
    scope: "select",
    tags: "multiSelect",
  },
  defaultSort: [{ id: "createdAt", desc: true }],
});

const filter = (overrides: Record<string, unknown>) => ({
  id: "action",
  variant: "text",
  operator: "iLike",
  value: "login",
  ...overrides,
});

const ok = (input: unknown) => listInput.safeParse(input);

describe("createListInput defaults and pagination", () => {
  test("applies defaults", () => {
    const parsed = listInput.parse({});
    expect(parsed).toEqual({
      page: 1,
      perPage: 20,
      sort: [{ id: "createdAt", desc: true }],
      filters: [],
      joinOperator: "and",
    });
  });

  test("an explicit empty sort stays empty", () => {
    expect(listInput.parse({ sort: [] }).sort).toEqual([]);
  });

  test("rejects out of range page and perPage", () => {
    expect(ok({ page: 0 }).success).toBe(false);
    expect(ok({ page: 1.5 }).success).toBe(false);
    expect(ok({ perPage: 0 }).success).toBe(false);
    expect(ok({ perPage: MAX_PAGE_SIZE + 1 }).success).toBe(false);
    expect(ok({ perPage: MAX_PAGE_SIZE }).success).toBe(true);
  });

  test("caps page so the offset stays bounded, per page size", () => {
    for (const perPage of [1, 20, MAX_PAGE_SIZE]) {
      const maxPage = getMaxPage(perPage);
      expect(ok({ page: maxPage, perPage }).success).toBe(true);
      expect(ok({ page: maxPage + 1, perPage }).success).toBe(false);
    }
    expect(ok({ page: 10 ** 12 }).success).toBe(false);
    expect(toLimitOffset({ page: getMaxPage(20), perPage: 20 }).offset).toBeLessThanOrEqual(
      MAX_OFFSET,
    );
  });

  test("toLimitOffset maps page and perPage", () => {
    expect(toLimitOffset({ page: 3, perPage: 10 })).toEqual({ limit: 10, offset: 20 });
  });
});

describe("createListInput with the Drizzle adapter", () => {
  test("a parsed input feeds buildListQuery", () => {
    const parsed = listInput.parse({
      page: 2,
      perPage: 10,
      filters: [filter({})],
    });
    const columns = { createdAt: auditLog.createdAt, action: auditLog.action };
    const query = buildListQuery({ columns, input: parsed });
    expect(query.limit).toBe(10);
    expect(query.offset).toBe(10);
    expect(query.where).toBeDefined();
    expect(query.orderBy).toHaveLength(1);
  });
});

describe("createListInput sort", () => {
  test("accepts allowlisted ids, at most three", () => {
    expect(ok({ sort: [{ id: "action", desc: false }] }).success).toBe(true);
    expect(
      ok({
        sort: [
          { id: "action", desc: false },
          { id: "createdAt", desc: true },
        ],
      }).success,
    ).toBe(true);
  });

  test("rejects an id outside the allowlist, including prototype keys", () => {
    expect(ok({ sort: [{ id: "password", desc: false }] }).success).toBe(false);
    expect(ok({ sort: [{ id: "constructor", desc: false }] }).success).toBe(false);
    expect(ok({ sort: [{ id: "amount", desc: false }] }).success).toBe(false);
  });

  test("rejects more than the sort cap, using allowlisted ids so only the cap can fail", () => {
    const ids = ["a", "b", "c", "d", "e"].slice(0, MAX_SORT_ITEMS + 1);
    const wide = createListInput({ sortableColumns: ids, filterableColumns: {} });
    const items = (count: number) => ids.slice(0, count).map((id) => ({ id, desc: false }));
    expect(wide.safeParse({ sort: items(MAX_SORT_ITEMS) }).success).toBe(true);
    expect(wide.safeParse({ sort: items(MAX_SORT_ITEMS + 1) }).success).toBe(false);
  });

  test("rejects duplicate ids", () => {
    const dup = [
      { id: "action", desc: false },
      { id: "action", desc: true },
    ];
    expect(ok({ sort: dup }).success).toBe(false);
  });
});

describe("createListInput filters", () => {
  test("accepts valid filters per variant", () => {
    const valid = [
      filter({}),
      filter({ operator: "isEmpty", value: "" }),
      filter({ id: "amount", variant: "number", operator: "gte", value: "10.5" }),
      filter({ id: "amount", variant: "number", operator: "isBetween", value: ["1", "5"] }),
      filter({ id: "createdAt", variant: "date", operator: "eq", value: "1767225600000" }),
      filter({
        id: "createdAt",
        variant: "date",
        operator: "isBetween",
        value: ["1767225600000", "1769904000000"],
      }),
      filter({ id: "active", variant: "boolean", operator: "ne", value: "true" }),
      filter({ id: "scope", variant: "select", operator: "eq", value: "platform" }),
      filter({ id: "tags", variant: "multiSelect", operator: "inArray", value: ["a", "b"] }),
      filter({ filterId: "filter-1" }),
    ];
    for (const item of valid) {
      expect(ok({ filters: [item], joinOperator: "or" }).success).toBe(true);
    }
  });

  test("rejects an unknown column id", () => {
    expect(ok({ filters: [filter({ id: "passwordHash" })] }).success).toBe(false);
    expect(ok({ filters: [filter({ id: "__proto__" })] }).success).toBe(false);
    expect(ok({ filters: [filter({ id: "action; drop table" })] }).success).toBe(false);
  });

  test("rejects a variant that differs from the column's declared variant", () => {
    expect(
      ok({ filters: [filter({ variant: "number", operator: "eq", value: "1" })] }).success,
    ).toBe(false);
  });

  test("rejects an operator the variant does not support", () => {
    expect(ok({ filters: [filter({ operator: "gt" })] }).success).toBe(false);
    expect(ok({ filters: [filter({ operator: "inArray", value: ["a"] })] }).success).toBe(false);
    expect(ok({ filters: [filter({ operator: "DROP" })] }).success).toBe(false);
  });

  test("rejects isRelativeToToday even on a date column", () => {
    const relative = filter({
      id: "createdAt",
      variant: "date",
      operator: "isRelativeToToday",
      value: "1 days",
    });
    expect(ok({ filters: [relative] }).success).toBe(false);
  });

  test("rejects values with the wrong shape", () => {
    const bad = [
      filter({ value: ["a"] }),
      filter({ value: "" }),
      filter({ id: "amount", variant: "number", operator: "eq", value: "abc" }),
      filter({ id: "amount", variant: "number", operator: "eq", value: "Infinity" }),
      filter({ id: "amount", variant: "number", operator: "isBetween", value: ["1"] }),
      filter({ id: "createdAt", variant: "date", operator: "eq", value: "yesterday" }),
      filter({ id: "createdAt", variant: "date", operator: "eq", value: "1.5" }),
      filter({ id: "active", variant: "boolean", operator: "eq", value: "yes" }),
      filter({ id: "tags", variant: "multiSelect", operator: "inArray", value: "a" }),
      filter({ id: "tags", variant: "multiSelect", operator: "inArray", value: [] }),
    ];
    for (const item of bad) {
      expect(ok({ filters: [item] }).success).toBe(false);
    }
  });

  test("caps the number of filters", () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, index) => filter({ filterId: `filter-${index}` }));
    expect(ok({ filters: many(MAX_FILTERS) }).success).toBe(true);
    expect(ok({ filters: many(MAX_FILTERS + 1) }).success).toBe(false);
  });

  test("rejects non-decimal and unsafe numbers", () => {
    for (const value of ["0x10", "1e300", "1e3", "9007199254740993", "+5", " 5"]) {
      expect(
        ok({ filters: [filter({ id: "amount", variant: "number", operator: "eq", value })] })
          .success,
      ).toBe(false);
    }
    expect(
      ok({
        filters: [
          filter({ id: "amount", variant: "number", operator: "isBetween", value: ["1", "1e3"] }),
        ],
      }).success,
    ).toBe(false);
  });

  test("rejects dates whose day window is not a valid Date", () => {
    for (const value of ["8640000000000000", "99999999999999999999"]) {
      expect(
        ok({ filters: [filter({ id: "createdAt", variant: "date", operator: "eq", value })] })
          .success,
      ).toBe(false);
    }
  });

  test("rejects an invalid join operator and unknown keys on a filter", () => {
    expect(ok({ joinOperator: "xor" }).success).toBe(false);
    expect(ok({ filters: [filter({ extra: 1 })] }).success).toBe(false);
  });

  test("an empty allowlist rejects every sort and filter id", () => {
    const none = createListInput({ sortableColumns: [], filterableColumns: {} });
    expect(none.safeParse({}).success).toBe(true);
    expect(none.safeParse({ sort: [{ id: "x", desc: false }] }).success).toBe(false);
    expect(none.safeParse({ filters: [filter({})] }).success).toBe(false);
  });
});

describe("createListInput per-column constraints", () => {
  const constrained = createListInput({
    sortableColumns: [],
    filterableColumns: {
      count: { variant: "number", integer: true },
      price: { variant: "number" },
      level: { variant: "select", options: ["low", "high"] },
      labels: { variant: "multiSelect", options: ["a", "b"] },
      free: "select",
      title: { variant: "text" },
    },
  });
  const parse = (item: Record<string, unknown>) => constrained.safeParse({ filters: [item] });

  test("integer columns reject fractions, decimal columns accept them", () => {
    const count = (operator: string, value: unknown) =>
      parse({ id: "count", variant: "number", operator, value });
    expect(count("eq", "4").success).toBe(true);
    expect(count("eq", "4.5").success).toBe(false);
    expect(count("isBetween", ["1", "2.5"]).success).toBe(false);
    expect(parse({ id: "price", variant: "number", operator: "eq", value: "4.5" }).success).toBe(
      true,
    );
  });

  test("select columns accept only their options", () => {
    const level = (operator: string, value: unknown) =>
      parse({ id: "level", variant: "select", operator, value });
    expect(level("eq", "low").success).toBe(true);
    expect(level("ne", "high").success).toBe(true);
    expect(level("eq", "medium").success).toBe(false);
    expect(level("isEmpty", "").success).toBe(true);
  });

  test("multiSelect columns accept only lists of their options", () => {
    const labels = (operator: string, value: unknown) =>
      parse({ id: "labels", variant: "multiSelect", operator, value });
    expect(labels("inArray", ["a", "b"]).success).toBe(true);
    expect(labels("notInArray", ["a"]).success).toBe(true);
    expect(labels("inArray", ["a", "z"]).success).toBe(false);
  });

  test("a select without options accepts any value; a bare variant is the shorthand", () => {
    expect(
      parse({ id: "free", variant: "select", operator: "eq", value: "anything" }).success,
    ).toBe(true);
  });

  test("options on a variant that has none, and integer on a non-number, fail at creation", () => {
    expect(() =>
      createListInput({
        sortableColumns: [],
        filterableColumns: { title: { variant: "text", options: ["x"] } },
      }),
    ).toThrow();
    expect(() =>
      createListInput({
        sortableColumns: [],
        filterableColumns: { title: { variant: "text", integer: true } },
      }),
    ).toThrow();
  });

  test("an empty options list fails at creation instead of silently rejecting every value", () => {
    expect(() =>
      createListInput({
        sortableColumns: [],
        filterableColumns: { level: { variant: "select", options: [] } },
      }),
    ).toThrow(/options/);
  });

  test("an empty variant list (no filterable columns) rejects every filter", () => {
    const none = createListInput({ sortableColumns: ["a"], filterableColumns: {} });
    expect(none.safeParse({ filters: [filter({})] }).success).toBe(false);
    expect(none.safeParse({ sort: [{ id: "a", desc: true }] }).success).toBe(true);
  });
});
