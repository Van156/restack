import { describe, expect, test } from "bun:test";

import type { ColumnFilter } from "./types";

import {
  createDataTableSearchSchema,
  mergeTableSearch,
  resetPageOnFilterChange,
  serializeDataTableSearch,
} from "./search";

const config = {
  columnIds: ["name", "email", "createdAt", "role"],
  filterableColumnIds: ["name", "role", "createdAt"],
  defaultSort: [{ id: "createdAt", desc: true }],
  defaultPerPage: 20,
} as const;

const schema = createDataTableSearchSchema(config);

function filter(overrides: Partial<ColumnFilter> = {}): ColumnFilter {
  return {
    id: "name",
    value: "ann",
    variant: "text",
    operator: "iLike",
    filterId: "f1",
    ...overrides,
  };
}

describe("createDataTableSearchSchema defaults", () => {
  test("an empty search yields the defaults", () => {
    expect(schema.parse({})).toEqual({
      page: 1,
      perPage: 20,
      sort: [{ id: "createdAt", desc: true }],
      filters: [],
      joinOperator: "and",
    });
  });

  test("a non-object search yields the defaults instead of throwing", () => {
    expect(schema.parse(undefined).page).toBe(1);
    expect(schema.parse("x").perPage).toBe(20);
    expect(schema.parse(null).filters).toEqual([]);
  });

  test("valid values are kept", () => {
    const parsed = schema.parse({
      page: 3,
      perPage: 50,
      sort: [{ id: "name", desc: false }],
      joinOperator: "or",
    });
    expect(parsed).toMatchObject({
      page: 3,
      perPage: 50,
      sort: [{ id: "name", desc: false }],
      joinOperator: "or",
    });
  });
});

describe("page and perPage", () => {
  test("invalid page falls back to 1", () => {
    for (const page of [0, -2, 1.5, "abc", null, Number.NaN, {}]) {
      expect(schema.parse({ page }).page).toBe(1);
    }
  });

  test("perPage outside 1..maxPerPage falls back to the default", () => {
    for (const perPage of [0, -1, 101, 10.5, "x"]) {
      expect(schema.parse({ perPage }).perPage).toBe(20);
    }
    expect(schema.parse({ perPage: 100 }).perPage).toBe(100);
  });

  test("maxPerPage is configurable", () => {
    const small = createDataTableSearchSchema({ ...config, maxPerPage: 30 });
    expect(small.parse({ perPage: 50 }).perPage).toBe(20);
    expect(small.parse({ perPage: 30 }).perPage).toBe(30);
  });

  test("perPageOptions restrict the accepted sizes", () => {
    const restricted = createDataTableSearchSchema({ ...config, perPageOptions: [10, 20, 40] });
    expect(restricted.parse({ perPage: 40 }).perPage).toBe(40);
    expect(restricted.parse({ perPage: 25 }).perPage).toBe(20);
  });
});

describe("sort", () => {
  test("accepts an array, a single object and a JSON string", () => {
    const sort = [{ id: "name", desc: true }];
    expect(schema.parse({ sort }).sort).toEqual(sort);
    expect(schema.parse({ sort: sort[0] }).sort).toEqual(sort);
    expect(schema.parse({ sort: JSON.stringify(sort) }).sort).toEqual(sort);
  });

  test("unknown column ids are dropped", () => {
    expect(
      schema.parse({
        sort: [
          { id: "nope", desc: false },
          { id: "email", desc: false },
        ],
      }).sort,
    ).toEqual([{ id: "email", desc: false }]);
  });

  test("falls back to the default when nothing valid remains", () => {
    const fallback = [{ id: "createdAt", desc: true }];
    expect(schema.parse({ sort: [{ id: "nope", desc: true }] }).sort).toEqual(fallback);
    expect(schema.parse({ sort: "not json" }).sort).toEqual(fallback);
    expect(schema.parse({ sort: 5 }).sort).toEqual(fallback);
    expect(schema.parse({ sort: [{ id: "name" }] }).sort).toEqual(fallback);
  });

  test("an explicit empty list means unsorted", () => {
    expect(schema.parse({ sort: [] }).sort).toEqual([]);
  });

  test("duplicate ids keep the first and the list is capped at three", () => {
    const parsed = schema.parse({
      sort: [
        { id: "name", desc: false },
        { id: "name", desc: true },
        { id: "email", desc: false },
        { id: "role", desc: false },
        { id: "createdAt", desc: false },
      ],
    }).sort;
    expect(parsed.map((item) => item.id)).toEqual(["name", "email", "role"]);
    expect(parsed[0]?.desc).toBe(false);
  });
});

describe("advanced filters", () => {
  test("keeps valid filters", () => {
    const valid = filter();
    expect(schema.parse({ filters: [valid] }).filters).toEqual([valid]);
    expect(schema.parse({ filters: JSON.stringify([valid]) }).filters).toEqual([valid]);
  });

  test("drops unknown columns, non-filterable columns, bad variants and invalid operators", () => {
    const valid = filter();
    const parsed = schema.parse({
      filters: [
        filter({ id: "nope", filterId: "a" }),
        filter({ id: "email", filterId: "b" }),
        filter({ operator: "gt", filterId: "c" }),
        // @ts-expect-error deliberately invalid variant
        filter({ variant: "weird", filterId: "d" }),
        // @ts-expect-error deliberately invalid operator
        filter({ operator: "DROP TABLE", filterId: "e" }),
        valid,
      ],
    });
    expect(parsed.filters).toEqual([valid]);
  });

  test("drops incomplete filters and malformed items", () => {
    const empty = filter({ operator: "isEmpty", value: "", filterId: "x" });
    const parsed = schema.parse({
      filters: [filter({ value: "", filterId: "y" }), { id: "name" }, 4, null, empty],
    });
    expect(parsed.filters).toEqual([empty]);
  });

  test("a filter without a filterId is dropped", () => {
    const { filterId: _omit, ...rest } = filter();
    expect(schema.parse({ filters: [rest] }).filters).toEqual([]);
  });

  test("non-array filters fall back to none", () => {
    expect(schema.parse({ filters: "garbage" }).filters).toEqual([]);
    expect(schema.parse({ filters: { id: "name" } }).filters).toEqual([]);
  });

  test("joinOperator falls back to and", () => {
    expect(schema.parse({ joinOperator: "xor" }).joinOperator).toBe("and");
    expect(schema.parse({ joinOperator: "or" }).joinOperator).toBe("or");
  });

  test("all columns are filterable when filterableColumnIds is omitted", () => {
    const all = createDataTableSearchSchema({
      columnIds: ["name", "email"],
      defaultSort: [],
      defaultPerPage: 10,
    });
    const email = filter({ id: "email" });
    expect(all.parse({ filters: [email] }).filters).toEqual([email]);
  });
});

describe("simple per-column filters", () => {
  test("filterable column ids become string params", () => {
    expect(schema.parse({ name: "ann", role: "admin,user" })).toMatchObject({
      name: "ann",
      role: "admin,user",
    });
  });

  test("non-filterable and unknown keys are stripped", () => {
    const parsed = schema.parse({ email: "x", nope: "y" });
    expect(parsed).not.toHaveProperty("email");
    expect(parsed).not.toHaveProperty("nope");
  });

  test("numbers, booleans and arrays are normalized to strings", () => {
    const parsed = schema.parse({ name: 12, role: ["a", "b"], createdAt: true });
    expect(parsed).toMatchObject({ name: "12", role: "a,b", createdAt: "true" });
  });

  test("empty and unusable values are omitted", () => {
    const parsed = schema.parse({ name: "", role: {}, createdAt: null });
    expect(parsed).not.toHaveProperty("name");
    expect(parsed).not.toHaveProperty("role");
    expect(parsed).not.toHaveProperty("createdAt");
  });

  test("a column id that collides with a reserved key is rejected at creation", () => {
    expect(() =>
      createDataTableSearchSchema({
        columnIds: ["page"],
        defaultSort: [],
        defaultPerPage: 10,
      }),
    ).toThrow(/reserved/);
  });
});

describe("serializeDataTableSearch (clearOnDefault)", () => {
  test("omits every default", () => {
    expect(serializeDataTableSearch(config, schema.parse({}))).toEqual({});
  });

  test("keeps non-default values only", () => {
    expect(
      serializeDataTableSearch(config, {
        page: 2,
        perPage: 50,
        sort: [{ id: "name", desc: false }],
        filters: [filter()],
        joinOperator: "or",
        role: "admin",
      }),
    ).toEqual({
      page: 2,
      perPage: 50,
      sort: [{ id: "name", desc: false }],
      filters: [filter()],
      joinOperator: "or",
      role: "admin",
    });
  });

  test("sort equal to the default is omitted, an empty sort is kept", () => {
    expect(serializeDataTableSearch(config, { sort: [{ id: "createdAt", desc: true }] })).toEqual(
      {},
    );
    expect(serializeDataTableSearch(config, { sort: [] })).toEqual({ sort: [] });
  });

  test("incomplete filters and empty simple values are not serialized", () => {
    expect(
      serializeDataTableSearch(config, {
        filters: [filter({ value: "" })],
        name: "",
        role: undefined,
      }),
    ).toEqual({});
  });

  test("round-trips through the schema", () => {
    const state = {
      page: 4,
      perPage: 10,
      sort: [
        { id: "name", desc: true },
        { id: "role", desc: false },
      ],
      filters: [
        filter(),
        filter({
          id: "role",
          value: ["a"],
          variant: "multiSelect",
          operator: "inArray",
          filterId: "f2",
        }),
      ],
      joinOperator: "or" as const,
    };
    const url = serializeDataTableSearch(config, state);
    // JSON-stringify/parse mimics TanStack Router's default search serialization.
    const wire = JSON.parse(JSON.stringify(url));
    expect(schema.parse(wire)).toEqual({ ...state });
  });
});

describe("resetPageOnFilterChange", () => {
  const current = { page: 5, perPage: 20, name: "a" };

  test("a filter change resets the page to 1", () => {
    expect(resetPageOnFilterChange(config, current, { name: "ab" })).toMatchObject({
      page: 1,
      name: "ab",
    });
    expect(resetPageOnFilterChange(config, current, { filters: [filter()] }).page).toBe(1);
    expect(resetPageOnFilterChange(config, current, { joinOperator: "or" }).page).toBe(1);
  });

  test("a perPage change resets the page to 1", () => {
    expect(resetPageOnFilterChange(config, current, { perPage: 50 }).page).toBe(1);
  });

  test("sort and page changes keep the page", () => {
    expect(resetPageOnFilterChange(config, current, { sort: [] }).page).toBe(5);
    expect(resetPageOnFilterChange(config, current, { page: 7 }).page).toBe(7);
  });

  test("an explicit page in the patch wins", () => {
    expect(resetPageOnFilterChange(config, current, { name: "x", page: 3 }).page).toBe(3);
  });

  test("a patch clears a simple filter with undefined", () => {
    expect(resetPageOnFilterChange(config, current, { name: undefined })).not.toHaveProperty(
      "name",
    );
  });

  test("does not mutate the input", () => {
    const before = { ...current };
    resetPageOnFilterChange(config, current, { name: "z" });
    expect(current).toEqual(before);
  });
});

describe("mergeTableSearch", () => {
  test("replaces the table's keys and keeps every other key", () => {
    const merged = mergeTableSearch(
      config,
      { page: 3, sort: [{ id: "name", desc: false }], name: "ann", tab: "audit", redirect: "/x" },
      { page: 2, role: "admin" },
    );
    expect(merged).toEqual({ tab: "audit", redirect: "/x", page: 2, role: "admin" });
  });

  test("clears the table's keys the next search leaves out (defaults omitted)", () => {
    const merged = mergeTableSearch(
      config,
      { page: 3, perPage: 50, filters: [filter()], joinOperator: "or", name: "x", keep: 1 },
      {},
    );
    expect(merged).toEqual({ keep: 1 });
  });
});
