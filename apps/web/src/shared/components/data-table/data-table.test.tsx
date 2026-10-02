import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { useDataTable } from "@/shared/hooks/use-data-table";

import { DataTable } from "./data-table";
import { DataTableActionBar } from "./data-table-action-bar";
import { DataTableToolbar } from "./data-table-toolbar";
import {
  memberColumns,
  memberRows,
  memberSearchConfig,
  memberSearchSchema,
  type MemberRow,
} from "./data-table-fixtures";

const empty = { title: "No members", description: "Nothing yet." };

type HarnessProps = {
  search?: unknown;
  rows?: MemberRow[];
  total?: number;
  isPending?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  isFetching?: boolean;
  isPlaceholderData?: boolean;
  selected?: string[];
  toolbar?: boolean;
};

function Harness({
  search = {},
  rows = memberRows,
  total = rows.length,
  selected = [],
  toolbar,
  ...rest
}: HarnessProps) {
  const parsed = memberSearchSchema.parse(search);
  const { table } = useDataTable({
    data: rows,
    columns: memberColumns,
    pageCount: Math.max(1, Math.ceil(total / parsed.perPage)),
    getRowId: (row) => row.id,
    search: parsed,
    searchConfig: memberSearchConfig,
    onSearchChange: () => {},
    initialState: { rowSelection: Object.fromEntries(selected.map((id) => [id, true])) },
  });
  return (
    <DataTable
      table={table}
      total={total}
      empty={empty}
      actionBar={<DataTableActionBar selectedCount={selected.length} onClearSelection={() => {}} />}
      {...rest}
    >
      {toolbar ? <DataTableToolbar table={table} /> : null}
    </DataTable>
  );
}

function render(props: HarnessProps = {}) {
  return renderToStaticMarkup(<Harness {...props} />);
}

const disabledButtons = (html: string) =>
  (html.match(/<button[^>]*>/g) ?? []).filter((tag) => /\sdisabled(=|>|\s)/.test(tag)).length;

describe("DataTable states", () => {
  test("renders the skeleton while pending", () => {
    const html = render({ isPending: true });
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('data-slot="skeleton"');
    expect(html).not.toContain("Ada Lovelace");
    expect(html).not.toContain("No members");
  });

  test("renders the empty state with no rows", () => {
    const html = render({ rows: [] });
    expect(html).toContain("No members");
    expect(html).toContain("Nothing yet.");
    expect(html).not.toContain("<table");
  });

  test("keeps the toolbar on the empty state so filters can be reset", () => {
    const html = render({ rows: [], toolbar: true, search: { name: "zzz" } });
    expect(html).toContain("Reset filters");
    expect(html).toContain("No members");
  });

  test("renders the error panel with a retry button", () => {
    const html = render({ rows: [], errorMessage: "Failed", onRetry: () => {} });
    expect(html).toContain("Failed");
    expect(html).toContain("Retry");
  });

  test("hides Retry when no handler is given", () => {
    const html = render({ rows: [], errorMessage: "Failed" });
    expect(html).toContain("Failed");
    expect(html).not.toContain("Retry");
  });

  test("keeps cached rows and shows an inline notice when a refetch failed", () => {
    const html = render({ errorMessage: "Refetch failed" });
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Refetch failed");
    expect(html).not.toContain("Something went wrong");
  });

  test("offers a way back from an empty page past the first", () => {
    const html = render({ rows: [], total: 12, search: { page: 4, perPage: 5 } });
    expect(html).toContain("Go to last page");
    expect(html).not.toContain("No members");
  });

  test("offers the first page when the last page is the current one", () => {
    const html = render({ rows: [], total: 10, search: { page: 2, perPage: 5 } });
    expect(html).toContain("Go to first page");
  });

  test("disables the pagination controls while a page fetch is in flight", () => {
    const search = { page: 2, perPage: 1 };
    const rows = [memberRows[1]!];
    const idle = render({ rows, total: 3, search });
    expect(disabledButtons(idle)).toBe(0);
    // Four navigation buttons and the page size select.
    expect(disabledButtons(render({ rows, total: 3, search, isPlaceholderData: true }))).toBe(5);
    expect(disabledButtons(render({ rows, total: 3, search, isFetching: true }))).toBe(5);
  });

  test("renders rows, headers and the pagination", () => {
    const html = render({ total: 42, search: { page: 2 } });
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Page 2 of 5");
    expect(html).toContain("Rows per page");
  });
});

describe("DataTable headers and selection", () => {
  test("sortable headers expose aria-sort from the route search", () => {
    const html = render({ search: { sort: [{ id: "role", desc: true }] } });
    const ariaSort = (name: string) =>
      new RegExp(`<th[^>]*aria-sort="(\\w+)"[^>]*>(?:(?!</th>).)*>${name}<`).exec(html)?.[1];
    expect(ariaSort("Role")).toBe("descending");
    expect(ariaSort("Name")).toBe("none");
    expect(html.match(/aria-sort=/g)?.length).toBe(memberColumns.length - 1);
  });

  test("the default sort is reflected as ascending", () => {
    expect(render()).toContain('aria-sort="ascending"');
  });

  test("the select column is not sortable so its header has no aria-sort", () => {
    const html = render();
    const selectTh = /<th[^>]*>(?:(?!<\/th>).)*Select all rows on this page/.exec(html)?.[0] ?? "";
    expect(selectTh).not.toContain("aria-sort");
  });

  test("marks selected rows and counts them in the pagination", () => {
    const html = render({ selected: ["m1", "m2"] });
    expect(html.match(/data-state="selected"/g)?.length).toBe(2);
    expect(html).toContain("2 rows selected.");
  });

  test("shows the action bar only while rows are selected", () => {
    expect(render()).not.toContain("Actions for selected rows");
    expect(render({ selected: ["m1"] })).toContain("Actions for selected rows");
  });
});

describe("DataTableToolbar", () => {
  test("renders a widget per filterable column and the view options", () => {
    const html = render({ toolbar: true });
    expect(html).toContain('placeholder="Search names..."');
    expect(html).toContain(">Role<");
    expect(html).toContain(">Status<");
    expect(html).toContain(">Score<");
    expect(html).toContain(">Joined<");
    expect(html).toContain("View");
    expect(html).not.toContain("Reset filters");
  });

  test("reflects active filters from the search and offers a reset", () => {
    const html = render({
      toolbar: true,
      search: { name: "ada", role: "admin,member", score: "10,50" },
    });
    expect(html).toContain('value="ada"');
    expect(html).toContain("Clear Role filter");
    expect(html).toContain("Clear Score filter");
    expect(html).toContain("10 - 50 pts");
    expect(html).toContain("Reset filters");
  });
});
