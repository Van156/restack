import { describe, expect, test } from "bun:test";

import type { ColumnFilter } from "./types";

import {
  addSort,
  advancedFiltersPatch,
  changeFilterColumn,
  changeFilterOperator,
  coerceFilterValue,
  createFilter,
  createFilterWithValue,
  filtersKey,
  getBuilderOperators,
  getAvailableSortColumns,
  nextFilterId,
  removeFilter,
  removeSort,
  updateFilter,
  updateSort,
} from "./advanced";
import { MAX_SORT_ITEMS } from "./search";

const nameFilter = (overrides: Partial<ColumnFilter> = {}): ColumnFilter => ({
  id: "name",
  value: "ada",
  variant: "text",
  operator: "iLike",
  filterId: "filter-1",
  ...overrides,
});

describe("nextFilterId", () => {
  test("starts at filter-1 and is deterministic", () => {
    expect(nextFilterId([])).toBe("filter-1");
    expect(nextFilterId([])).toBe("filter-1");
  });

  test("never collides with an existing id, even after removals", () => {
    expect(nextFilterId([{ filterId: "filter-1" }, { filterId: "filter-2" }])).toBe("filter-3");
    expect(nextFilterId([{ filterId: "filter-5" }])).toBe("filter-6");
  });

  test("ignores ids that are not in the filter-N shape", () => {
    expect(nextFilterId([{ filterId: "abc" }, { filterId: "filter-x" }])).toBe("filter-1");
  });
});

describe("createFilter", () => {
  test("uses the first operator of the variant and an empty value", () => {
    expect(createFilter({ id: "name", variant: "text" }, [])).toEqual({
      id: "name",
      variant: "text",
      operator: "iLike",
      value: "",
      filterId: "filter-1",
    });
  });

  test("always generates a filterId that is unique in the list", () => {
    const first = createFilter({ id: "name", variant: "text" }, []);
    const second = createFilter({ id: "role", variant: "select" }, [first]);
    expect(second.filterId).toBe("filter-2");
  });

  test("multi select starts with an empty list", () => {
    expect(createFilter({ id: "role", variant: "multiSelect" }, []).value).toEqual([]);
  });

  test("boolean starts complete (true) so it is valid at once", () => {
    const filter = createFilter({ id: "active", variant: "boolean" }, []);
    expect(filter.value).toBe("true");
    expect(filter.operator).toBe("eq");
  });
});

describe("coerceFilterValue", () => {
  test("isBetween needs two ends", () => {
    expect(coerceFilterValue("isBetween", "5")).toEqual(["5", ""]);
    expect(coerceFilterValue("isBetween", "")).toEqual(["", ""]);
    expect(coerceFilterValue("isBetween", ["1", "2"])).toEqual(["1", "2"]);
    expect(coerceFilterValue("isBetween", ["1"])).toEqual(["1", ""]);
  });

  test("list operators need a list", () => {
    expect(coerceFilterValue("inArray", "a")).toEqual(["a"]);
    expect(coerceFilterValue("inArray", "")).toEqual([]);
    expect(coerceFilterValue("notInArray", ["a", "b"])).toEqual(["a", "b"]);
  });

  test("empty operators carry no value", () => {
    expect(coerceFilterValue("isEmpty", "x")).toBe("");
    expect(coerceFilterValue("isNotEmpty", ["x"])).toBe("");
  });

  test("scalar operators take the first item of a list", () => {
    expect(coerceFilterValue("eq", ["a", "b"])).toBe("a");
    expect(coerceFilterValue("eq", [])).toBe("");
    expect(coerceFilterValue("iLike", "abc")).toBe("abc");
  });
});

describe("changing a filter row", () => {
  test("changing the column resets variant, operator and value but keeps the filterId", () => {
    const next = changeFilterColumn(nameFilter(), { id: "role", variant: "multiSelect" });
    expect(next).toEqual({
      id: "role",
      variant: "multiSelect",
      operator: "inArray",
      value: [],
      filterId: "filter-1",
    });
  });

  test("changing the operator coerces the value to the operator's shape", () => {
    const next = changeFilterOperator(
      nameFilter({ id: "score", variant: "number", operator: "eq", value: "5" }),
      "isBetween",
    );
    expect(next.operator).toBe("isBetween");
    expect(next.value).toEqual(["5", ""]);
    expect(changeFilterOperator(next, "isEmpty").value).toBe("");
  });

  test("updateFilter patches only the row with that filterId", () => {
    const filters = [nameFilter(), nameFilter({ filterId: "filter-2", value: "bo" })];
    const next = updateFilter(filters, "filter-2", { value: "bob" });
    expect(next[0]).toBe(filters[0]!);
    expect(next[1]?.value).toBe("bob");
    expect(filters[1]?.value).toBe("bo");
  });

  test("updateFilter routes column and operator changes through their rules", () => {
    const filters = [nameFilter()];
    expect(updateFilter(filters, "filter-1", { operator: "isEmpty" })[0]?.value).toBe("");
  });

  test("removeFilter drops one row", () => {
    const filters = [nameFilter(), nameFilter({ filterId: "filter-2" })];
    expect(removeFilter(filters, "filter-1").map((f) => f.filterId)).toEqual(["filter-2"]);
    expect(removeFilter(filters, "missing")).toHaveLength(2);
  });
});

describe("advancedFiltersPatch", () => {
  test("null when the valid filters did not change (an unfinished row is local only)", () => {
    const committed = [nameFilter()];
    const draft = [...committed, nameFilter({ filterId: "filter-2", value: "" })];
    expect(advancedFiltersPatch(draft, committed)).toBeNull();
  });

  test("the patch carries only the valid filters", () => {
    const draft = [nameFilter(), nameFilter({ filterId: "filter-2", value: "" })];
    expect(advancedFiltersPatch(draft, [])).toEqual({ filters: [nameFilter()] });
  });

  test("clearing the last filter is a patch to an empty list", () => {
    expect(advancedFiltersPatch([], [nameFilter()])).toEqual({ filters: [] });
  });

  test("a value edit is a patch; reordering is a patch", () => {
    const a = nameFilter();
    const b = nameFilter({ filterId: "filter-2", value: "bo" });
    expect(advancedFiltersPatch([nameFilter({ value: "ad" })], [a])).not.toBeNull();
    expect(advancedFiltersPatch([b, a], [a, b])).not.toBeNull();
  });
});

describe("filtersKey", () => {
  test("only valid filters count and order matters", () => {
    const a = nameFilter();
    const b = nameFilter({ filterId: "filter-2", value: "bo" });
    const unfinished = nameFilter({ filterId: "filter-3", value: "" });
    expect(filtersKey([a, unfinished])).toBe(filtersKey([a]));
    expect(filtersKey([a, b])).not.toBe(filtersKey([b, a]));
  });
});

describe("sort helpers", () => {
  const columns = [
    { id: "name", label: "Name" },
    { id: "role", label: "Role" },
    { id: "score", label: "Score" },
  ];

  test("available columns exclude the ones already sorted", () => {
    expect(
      getAvailableSortColumns(columns, [{ id: "name", desc: false }]).map((c) => c.id),
    ).toEqual(["role", "score"]);
  });

  test("addSort appends the first available column ascending", () => {
    expect(addSort([{ id: "name", desc: true }], columns)).toEqual([
      { id: "name", desc: true },
      { id: "role", desc: false },
    ]);
  });

  test("addSort is a no-op with no column left or at the maximum", () => {
    const all = columns.map((c) => ({ id: c.id, desc: false }));
    expect(addSort(all, columns)).toEqual(all);
    expect(MAX_SORT_ITEMS).toBe(3);
    const four = [...columns, { id: "x", label: "X" }, { id: "y", label: "Y" }];
    const full = [
      { id: "name", desc: false },
      { id: "role", desc: false },
      { id: "score", desc: false },
    ];
    expect(addSort(full, four)).toEqual(full);
  });

  test("updateSort changes direction or column of one item", () => {
    const sorting = [
      { id: "name", desc: false },
      { id: "role", desc: false },
    ];
    expect(updateSort(sorting, "role", { desc: true })).toEqual([
      { id: "name", desc: false },
      { id: "role", desc: true },
    ]);
    expect(updateSort(sorting, "role", { id: "score" })[1]).toEqual({ id: "score", desc: false });
  });

  test("updateSort refuses to duplicate a column", () => {
    const sorting = [
      { id: "name", desc: false },
      { id: "role", desc: false },
    ];
    expect(updateSort(sorting, "role", { id: "name" })).toEqual(sorting);
  });

  test("removeSort drops one item", () => {
    expect(
      removeSort(
        [
          { id: "name", desc: false },
          { id: "role", desc: true },
        ],
        "name",
      ),
    ).toEqual([{ id: "role", desc: true }]);
  });
});

describe("createFilterWithValue", () => {
  test("a text value becomes a complete row with the default operator", () => {
    const filter = createFilterWithValue({ id: "name", variant: "text" }, [], "ada");
    expect(filter).toEqual({
      id: "name",
      variant: "text",
      operator: "iLike",
      value: "ada",
      filterId: "filter-1",
    });
  });

  test("a multi select value is wrapped in a list", () => {
    expect(
      createFilterWithValue({ id: "role", variant: "multiSelect" }, [], "admin").value,
    ).toEqual(["admin"]);
  });

  test("a single select keeps the string", () => {
    expect(createFilterWithValue({ id: "status", variant: "select" }, [], "active").value).toBe(
      "active",
    );
  });
});

describe("getBuilderOperators", () => {
  test("offers the variant operators", () => {
    expect(getBuilderOperators("text").map((o) => o.value)).toEqual([
      "iLike",
      "notILike",
      "eq",
      "ne",
      "isEmpty",
      "isNotEmpty",
    ]);
  });

  test("hides isRelativeToToday: its value has no defined meaning in the URL contract yet", () => {
    const values = getBuilderOperators("date").map((o) => o.value);
    expect(values).not.toContain("isRelativeToToday");
    expect(values).toContain("isBetween");
  });
});
