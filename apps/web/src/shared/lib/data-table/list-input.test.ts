import { createListInput } from "@base-template/api/lib/list-input";
import {
  getMaxPage,
  MAX_FILTERS,
  MAX_OFFSET,
  MAX_SORT_ITEMS,
} from "@base-template/api/lib/list-vocabulary";
import { describe, expect, test } from "bun:test";

import { isFilterAccepted, toListInput } from "./list-input";
import type { ColumnFilter } from "./types";

const schema = createListInput({
  sortableColumns: ["createdAt", "action"],
  filterableColumns: {
    createdAt: "date",
    action: { variant: "select", options: ["a.one", "a.two"] },
    note: "text",
  },
  defaultSort: [{ id: "createdAt", desc: true }],
});

const filter = (partial: Partial<ColumnFilter> = {}): ColumnFilter => ({
  id: "note",
  value: "x",
  variant: "text",
  operator: "iLike",
  filterId: "filter-1",
  ...partial,
});

const search = (partial: Record<string, unknown> = {}) => ({
  page: 1,
  perPage: 20,
  sort: [{ id: "createdAt", desc: true }],
  filters: [] as ColumnFilter[],
  joinOperator: "and" as const,
  ...partial,
});

describe("isFilterAccepted", () => {
  test("accepts a filter the list input accepts", () => {
    expect(isFilterAccepted(schema, filter())).toBe(true);
  });

  test("rejects a variant that differs from the column's, a value outside the options and unknown ids", () => {
    expect(isFilterAccepted(schema, filter({ variant: "number", operator: "eq" }))).toBe(false);
    expect(
      isFilterAccepted(
        schema,
        filter({ id: "action", variant: "select", operator: "eq", value: "nope" }),
      ),
    ).toBe(false);
    expect(isFilterAccepted(schema, filter({ id: "secret" }))).toBe(false);
  });

  test("rejects isRelativeToToday, which the server does not evaluate", () => {
    expect(
      isFilterAccepted(
        schema,
        filter({
          id: "createdAt",
          variant: "date",
          operator: "isRelativeToToday",
          value: "1 days",
        }),
      ),
    ).toBe(false);
  });
});

describe("toListInput", () => {
  test("maps page, perPage, sort, filters and join operator", () => {
    const input = toListInput(
      schema,
      search({
        page: 3,
        perPage: 10,
        sort: [{ id: "action", desc: false }],
        filters: [filter()],
        joinOperator: "or",
      }),
    );
    expect(input as unknown).toEqual({
      page: 3,
      perPage: 10,
      sort: [{ id: "action", desc: false }],
      filters: [filter()],
      joinOperator: "or",
    });
    expect(schema.safeParse(input).success).toBe(true);
  });

  test("drops filters the server would reject instead of failing the whole list", () => {
    const input = toListInput(
      schema,
      search({
        filters: [
          filter(),
          filter({
            id: "action",
            variant: "select",
            operator: "eq",
            value: "nope",
            filterId: "filter-2",
          }),
        ],
      }),
    );
    expect(input.filters as unknown).toEqual([filter()]);
  });

  test("clamps a page beyond the deepest page the server accepts", () => {
    const input = toListInput(schema, search({ page: 10 ** 9, perPage: 20 }));
    expect(input.page).toBe(getMaxPage(20));
    expect(((input.page ?? 1) - 1) * 20).toBeLessThanOrEqual(MAX_OFFSET);
    expect(schema.safeParse(input).success).toBe(true);
  });

  test("caps filters and sort items so a stale URL degrades instead of failing the list", () => {
    const sortable = createListInput({
      sortableColumns: ["a", "b", "c", "d", "e"],
      filterableColumns: { note: "text" },
    });
    const many = Array.from({ length: MAX_FILTERS + 5 }, (_, index) =>
      filter({ filterId: `filter-${index}` }),
    );
    const input = toListInput(
      sortable,
      search({
        sort: ["a", "b", "c", "d", "e"].map((id) => ({ id, desc: false })),
        filters: many,
      }),
    );
    expect(input.filters).toHaveLength(MAX_FILTERS);
    expect(input.sort).toHaveLength(MAX_SORT_ITEMS);
    expect(input.sort?.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(sortable.safeParse(input).success).toBe(true);
  });

  test("counts only accepted filters toward the cap", () => {
    const rejected = Array.from({ length: MAX_FILTERS }, (_, index) =>
      filter({ id: "secret", filterId: `bad-${index}` }),
    );
    const input = toListInput(schema, search({ filters: [...rejected, filter()] }));
    expect(input.filters as unknown).toEqual([filter()]);
  });
});
