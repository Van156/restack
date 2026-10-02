import { describe, expect, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import { renderToStaticMarkup } from "react-dom/server";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";
import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { ColumnFilter } from "@/shared/lib/data-table/types";

import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";

import { useDataTable } from "./use-data-table";

type Row = { id: string; email: string; role: string };

const config = {
  columnIds: ["email", "role"],
  defaultSort: [{ id: "email", desc: false }],
  defaultPerPage: 20,
} as const satisfies DataTableSearchConfig<"email" | "role">;

const schema = createDataTableSearchSchema(config);

const columns: DataTableColumnDef<Row, string>[] = [
  {
    id: "email",
    accessorKey: "email",
    meta: { label: "Email", variant: "text" },
    enableColumnFilter: true,
  },
  {
    id: "role",
    accessorKey: "role",
    meta: { label: "Role", variant: "multiSelect" },
    enableColumnFilter: true,
  },
];

const rows: Row[] = [
  { id: "1", email: "ada@example.com", role: "admin" },
  { id: "2", email: "bo@example.com", role: "user" },
];

function Probe({ search }: { search: unknown }) {
  const { table } = useDataTable({
    data: rows,
    columns,
    pageCount: 4,
    getRowId: (row) => row.id,
    search: schema.parse(search),
    searchConfig: config,
    onSearchChange: () => {},
  });
  const state = table.state;
  return (
    <pre>
      {JSON.stringify({
        pagination: state.pagination,
        sorting: state.sorting,
        columnFilters: state.columnFilters,
        pageCount: table.getPageCount(),
        rows: table.getRowModel().rows.map((row) => row.id),
        emailSorted: table.getColumn("email")?.getIsSorted(),
        canFilter: table.getAllColumns().map((column) => column.getCanFilter()),
      })}
    </pre>
  );
}

function probe(search: unknown) {
  const html = renderToStaticMarkup(<Probe search={search} />);
  const json = html
    .replace(/^<pre>/, "")
    .replace(/<\/pre>$/, "")
    .replaceAll("&quot;", '"');
  return JSON.parse(json);
}

describe("useDataTable state from the route search", () => {
  test("maps page, perPage, sort and column filters to table state", () => {
    const result = probe({
      page: 3,
      perPage: 50,
      sort: [{ id: "role", desc: true }],
      email: "ada",
      role: "admin,user",
    });
    expect(result.pagination).toEqual({ pageIndex: 2, pageSize: 50 });
    expect(result.sorting).toEqual([{ id: "role", desc: true }]);
    expect(result.columnFilters).toEqual([
      { id: "email", value: "ada" },
      { id: "role", value: ["admin", "user"] },
    ]);
  });

  test("defaults: first page, default sort and no filters", () => {
    const result = probe({});
    expect(result.pagination).toEqual({ pageIndex: 0, pageSize: 20 });
    expect(result.sorting).toEqual([{ id: "email", desc: false }]);
    expect(result.columnFilters).toEqual([]);
    expect(result.emailSorted).toBe("asc");
  });

  test("is manual: rows are the given rows and pageCount is the server's", () => {
    const result = probe({ page: 2 });
    expect(result.rows).toEqual(["1", "2"]);
    expect(result.pageCount).toBe(4);
  });

  test("columns opt in to filtering", () => {
    expect(probe({}).canFilter).toEqual([true, true]);
  });
});

type Change = { next: Record<string, unknown>; replace: boolean };

function setup(search: unknown, debounceMs = 5, enableAdvancedFilter = false) {
  const changes: Change[] = [];
  let current: ReturnType<typeof useDataTable<Row>> | undefined;
  function Capture() {
    const result = useDataTable({
      data: rows,
      columns,
      pageCount: 4,
      search: schema.parse(search),
      searchConfig: config,
      onSearchChange: (next, options) => changes.push({ next, replace: options.replace }),
      debounceMs,
      enableAdvancedFilter,
    });
    current = result;
    return null;
  }
  renderToStaticMarkup(<Capture />);
  if (!current) {
    throw new Error("table not captured");
  }
  return { table: current.table, advanced: current.advanced, changes };
}

describe("useDataTable writes to the route search", () => {
  test("sorting replaces history, keeps the page and omits the default sort", () => {
    const { table, changes } = setup({ page: 3 });
    table.getColumn("role")?.toggleSorting(false);
    expect(changes).toEqual([
      { next: { page: 3, sort: [{ id: "role", desc: false }] }, replace: true },
    ]);
    changes.length = 0;
    table.setSorting([{ id: "email", desc: false }]);
    expect(changes).toEqual([{ next: { page: 3 }, replace: true }]);
  });

  test("clearing the sort writes an empty sort when the default is not empty", () => {
    const { table, changes } = setup({});
    table.setSorting([]);
    expect(changes[0]?.next).toEqual({ sort: [] });
  });

  test("page navigation writes a 1-based page", () => {
    const { table, changes } = setup({ page: 1 });
    table.setPageIndex(2);
    expect(changes).toEqual([{ next: { page: 3 }, replace: true }]);
  });

  test("a page size change resets the page and omits the default size", () => {
    const { table, changes } = setup({ page: 3, perPage: 50 });
    table.setPageSize(50);
    expect(changes).toEqual([]);
    table.setPageSize(20);
    expect(changes).toEqual([{ next: {}, replace: true }]);
  });

  test("a select filter is written immediately and resets the page", () => {
    const { table, changes } = setup({ page: 3 });
    table.getColumn("role")?.setFilterValue(["admin", "user"]);
    expect(changes).toEqual([{ next: { role: "admin,user" }, replace: true }]);
  });

  test("a text filter is debounced and only the last value is written", async () => {
    const { table, changes } = setup({ page: 3 }, 20);
    table.getColumn("email")?.setFilterValue("a");
    table.getColumn("email")?.setFilterValue("ad");
    expect(changes).toEqual([]);
    await sleep(60);
    expect(changes).toEqual([{ next: { email: "ad" }, replace: true }]);
  });

  test("resetColumnFilters removes the filter keys and resets the page", () => {
    const { table, changes } = setup({ page: 3, email: "ada", role: "admin" });
    table.resetColumnFilters();
    expect(changes).toEqual([{ next: {}, replace: true }]);
  });
});

const nameFilter = (overrides: Partial<ColumnFilter> = {}): ColumnFilter => ({
  id: "email",
  value: "ada",
  variant: "text",
  operator: "iLike",
  filterId: "filter-1",
  ...overrides,
});

describe("useDataTable advanced mode", () => {
  test("exposes the filters and join operator of the search", () => {
    const { advanced } = setup({ filters: [nameFilter()], joinOperator: "or" }, 5, true);
    expect(advanced.filters).toEqual([nameFilter()]);
    expect(advanced.joinOperator).toBe("or");
    expect(advanced.debounceMs).toBe(5);
  });

  test("defaults to no filters and the and join", () => {
    const { advanced } = setup({}, 5, true);
    expect(advanced.filters).toEqual([]);
    expect(advanced.joinOperator).toBe("and");
  });

  test("setFilters writes complete filters, replaces history and resets the page", () => {
    const { advanced, changes } = setup({ page: 3 }, 5, true);
    advanced.setFilters([nameFilter()]);
    expect(changes).toEqual([{ next: { filters: [nameFilter()] }, replace: true }]);
  });

  test("setFilters keeps unfinished rows out of the URL and does not write for them alone", () => {
    const { advanced, changes } = setup({ page: 3, filters: [nameFilter()] }, 5, true);
    advanced.setFilters([nameFilter(), nameFilter({ filterId: "filter-2", value: "" })]);
    expect(changes).toEqual([]);
    advanced.setFilters([
      nameFilter({ value: "ad" }),
      nameFilter({ filterId: "filter-2", value: "" }),
    ]);
    expect(changes).toEqual([{ next: { filters: [nameFilter({ value: "ad" })] }, replace: true }]);
  });

  test("removing the last filter writes an empty list and resets the page", () => {
    const { advanced, changes } = setup({ page: 3, filters: [nameFilter()] }, 5, true);
    advanced.setFilters([]);
    expect(changes).toEqual([{ next: {}, replace: true }]);
  });

  test("setJoinOperator writes or, resets the page, and ignores an unchanged value", () => {
    const { advanced, changes } = setup({ page: 3, filters: [nameFilter()] }, 5, true);
    advanced.setJoinOperator("and");
    expect(changes).toEqual([]);
    advanced.setJoinOperator("or");
    expect(changes).toEqual([
      { next: { filters: [nameFilter()], joinOperator: "or" }, replace: true },
    ]);
  });

  test("reset clears filters and join operator in one write, and is a no-op when pristine", () => {
    const pristine = setup({ page: 3 }, 5, true);
    pristine.advanced.reset();
    expect(pristine.changes).toEqual([]);
    const { advanced, changes } = setup(
      { page: 3, sort: [{ id: "role", desc: true }], filters: [nameFilter()], joinOperator: "or" },
      5,
      true,
    );
    advanced.reset();
    expect(changes).toEqual([{ next: { sort: [{ id: "role", desc: true }] }, replace: true }]);
  });

  test("column filter changes are ignored: filters belong to the builder", () => {
    const { table, changes } = setup({}, 5, true);
    table.getColumn("role")?.setFilterValue(["admin"]);
    expect(changes).toEqual([]);
    expect(table.state.columnFilters).toEqual([]);
  });

  test("sorting still goes through the route search and the default sort is the reset target", () => {
    const { table, changes } = setup({ sort: [{ id: "role", desc: true }] }, 5, true);
    expect(table.initialState.sorting).toEqual([{ id: "email", desc: false }]);
    table.setSorting(table.initialState.sorting);
    expect(changes).toEqual([{ next: {}, replace: true }]);
  });
});
