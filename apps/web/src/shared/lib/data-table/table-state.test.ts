import { describe, expect, test } from "bun:test";

import {
  columnFiltersToSearchPatch,
  formatFilterValue,
  getSimpleFilterColumns,
  pageIndexToSearchPatch,
  paginationToSearchPatch,
  parseFilterValue,
  searchToColumnFilters,
  searchToPagination,
  sortingToSearchSort,
  toAriaSort,
} from "./table-state";

const columns = [
  { id: "email", meta: { variant: "text" as const }, enableColumnFilter: true },
  { id: "role", meta: { variant: "multiSelect" as const }, enableColumnFilter: true },
  { id: "status", meta: { variant: "select" as const }, enableColumnFilter: true },
  { id: "age", meta: { variant: "range" as const }, enableColumnFilter: true },
  { id: "createdAt", meta: { variant: "dateRange" as const }, enableColumnFilter: true },
  { accessorKey: "plain", enableColumnFilter: true },
  { id: "notFilterable", meta: { variant: "text" as const } },
  { id: "disabled", meta: { variant: "text" as const }, enableColumnFilter: false },
];

describe("getSimpleFilterColumns", () => {
  test("keeps columns that opt in, with their variant (text by default) and id from accessorKey", () => {
    expect(getSimpleFilterColumns(columns)).toEqual([
      { id: "email", variant: "text" },
      { id: "role", variant: "multiSelect" },
      { id: "status", variant: "select" },
      { id: "age", variant: "range" },
      { id: "createdAt", variant: "dateRange" },
      { id: "plain", variant: "text" },
    ]);
  });
});

describe("parseFilterValue / formatFilterValue", () => {
  test("multiSelect is a comma list without blanks", () => {
    expect(parseFilterValue("multiSelect", "a,b,,c")).toEqual(["a", "b", "c"]);
    expect(formatFilterValue("multiSelect", ["a", "b"])).toBe("a,b");
    expect(formatFilterValue("multiSelect", [])).toBeUndefined();
    expect(formatFilterValue("multiSelect", [""])).toBeUndefined();
  });

  test("ranges are always a pair, an open end is an empty string", () => {
    expect(parseFilterValue("range", "10,50")).toEqual(["10", "50"]);
    expect(parseFilterValue("dateRange", "1700,")).toEqual(["1700", ""]);
    expect(parseFilterValue("range", "10")).toEqual(["10", ""]);
    expect(formatFilterValue("range", [10, 50])).toBe("10,50");
    expect(formatFilterValue("dateRange", [1700, undefined])).toBe("1700,");
    expect(formatFilterValue("dateRange", [undefined, undefined])).toBeUndefined();
  });

  test("single values are strings; numbers and dates (timestamps) are stringified", () => {
    expect(parseFilterValue("text", "ada")).toBe("ada");
    expect(formatFilterValue("text", "ada")).toBe("ada");
    expect(formatFilterValue("date", 1700000000000)).toBe("1700000000000");
    expect(formatFilterValue("text", "  ")).toBeUndefined();
    expect(formatFilterValue("text", undefined)).toBeUndefined();
    expect(formatFilterValue("select", ["x"])).toBe("x");
  });
});

describe("searchToColumnFilters", () => {
  const cols = getSimpleFilterColumns(columns);

  test("maps only filterable column keys present in the search", () => {
    expect(
      searchToColumnFilters(
        { page: 2, email: "ada", role: "admin,user", age: "1,5", other: "x", status: "" },
        cols,
      ),
    ).toEqual([
      { id: "email", value: "ada" },
      { id: "role", value: ["admin", "user"] },
      { id: "age", value: ["1", "5"] },
    ]);
  });

  test("no filter keys gives no column filters", () => {
    expect(searchToColumnFilters({ page: 1 }, cols)).toEqual([]);
  });
});

describe("columnFiltersToSearchPatch", () => {
  const cols = getSimpleFilterColumns(columns);

  test("patches only the keys that changed, removed filters become undefined", () => {
    const patch = columnFiltersToSearchPatch(
      [
        { id: "email", value: "ada" },
        { id: "role", value: ["admin"] },
      ],
      cols,
      { email: "ada", status: "active" },
    );
    expect(patch).toEqual({ role: "admin", status: undefined });
  });

  test("no change gives an empty patch (so the page is not reset)", () => {
    expect(
      columnFiltersToSearchPatch([{ id: "email", value: "ada" }], cols, { email: "ada" }),
    ).toEqual({});
  });

  test("an empty text filter removes the key", () => {
    expect(
      columnFiltersToSearchPatch([{ id: "email", value: "" }], cols, { email: "ada" }),
    ).toEqual({ email: undefined });
  });
});

describe("sorting mapping", () => {
  test("keeps known, unique ids in order and caps at three", () => {
    const sorting = [
      { id: "a", desc: false },
      { id: "zzz", desc: true },
      { id: "b", desc: true },
      { id: "a", desc: true },
      { id: "c", desc: false },
      { id: "d", desc: false },
    ];
    expect(sortingToSearchSort(sorting, ["a", "b", "c", "d"])).toEqual([
      { id: "a", desc: false },
      { id: "b", desc: true },
      { id: "c", desc: false },
    ]);
  });

  test("empty sorting is an empty sort (unsorted)", () => {
    expect(sortingToSearchSort([], ["a"])).toEqual([]);
  });
});

describe("pagination mapping", () => {
  test("page is 1-based in the URL and 0-based in the table", () => {
    expect(searchToPagination({ page: 3, perPage: 20 })).toEqual({ pageIndex: 2, pageSize: 20 });
    expect(searchToPagination({ page: 0, perPage: 20 })).toEqual({ pageIndex: 0, pageSize: 20 });
  });

  test("a page change patches page only", () => {
    expect(
      paginationToSearchPatch({ pageIndex: 3, pageSize: 20 }, { page: 1, perPage: 20 }),
    ).toEqual({ page: 4 });
  });

  test("a page size change patches perPage only, so the page resets to 1", () => {
    expect(
      paginationToSearchPatch({ pageIndex: 2, pageSize: 50 }, { page: 3, perPage: 20 }),
    ).toEqual({ perPage: 50 });
  });

  test("no change gives an empty patch", () => {
    expect(
      paginationToSearchPatch({ pageIndex: 0, pageSize: 20 }, { page: 1, perPage: 20 }),
    ).toEqual({});
  });

  test("pageIndexToSearchPatch is a 1-based page patch", () => {
    expect(pageIndexToSearchPatch(4)).toEqual({ page: 5 });
  });
});

describe("toAriaSort", () => {
  test("maps the sorted direction to aria-sort, only for sortable columns", () => {
    expect(toAriaSort("asc", true)).toBe("ascending");
    expect(toAriaSort("desc", true)).toBe("descending");
    expect(toAriaSort(false, true)).toBe("none");
    expect(toAriaSort("asc", false)).toBeUndefined();
    expect(toAriaSort(false, false)).toBeUndefined();
  });
});
