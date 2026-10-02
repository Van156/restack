import { describe, expect, test } from "bun:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";

import { usersSearchConfig, usersSearchSchema } from "../lib/users-search";
import { getUsersColumns } from "./users-columns";
import type { UsersTableRow } from "./users-columns";

const rows: UsersTableRow[] = [
  {
    id: "u1",
    email: "ada@example.com",
    name: "Ada",
    role: "superadmin",
    banned: false,
    createdAt: new Date("2026-01-02T00:00:00Z"),
  },
  {
    id: "u2",
    email: "bo@example.com",
    name: "Bo",
    role: null,
    banned: true,
    createdAt: new Date("2026-01-03T00:00:00Z"),
  },
];

function PlainLink({ id, children }: { id: string; children: ReactNode }) {
  return <a href={`/admin/users/${id}`}>{children}</a>;
}

type ListOverrides = {
  rows?: UsersTableRow[] | undefined;
  total?: number | undefined;
  errorMessage?: string | null;
};

const list = (overrides: ListOverrides = {}) => ({
  rows,
  total: rows.length,
  isPending: false,
  isFetching: false,
  isPlaceholderData: false,
  errorMessage: null,
  onRetry: () => {},
  ...overrides,
});

function render(search: unknown = {}, overrides: ListOverrides = {}) {
  return renderToStaticMarkup(
    <SimpleListTable
      search={usersSearchSchema.parse(search)}
      searchConfig={usersSearchConfig}
      onSearchChange={() => {}}
      columns={getUsersColumns({ UserLink: PlainLink })}
      emptyTitle="No users found."
      list={list(overrides)}
    />,
  );
}

describe("users columns", () => {
  const columns = getUsersColumns();

  test("column ids are the server list ids", () => {
    expect(columns.map((column) => column.id)).toEqual([
      "email",
      "name",
      "role",
      "status",
      "createdAt",
    ]);
  });

  test("filterable columns are exactly the search config's filter keys", () => {
    const filterable = columns.filter((column) => column.enableColumnFilter).map((c) => c.id);
    expect(filterable).toEqual([...usersSearchConfig.filterableColumnIds]);
  });

  test("status is not sortable; the other server sort columns are", () => {
    const sortable = columns.filter((column) => column.enableSorting !== false).map((c) => c.id);
    expect(sortable).toEqual([...usersSearchConfig.columnIds]);
  });
});

describe("SimpleListTable (users)", () => {
  test("renders the rows with a link to the user, role and status", () => {
    const html = render();
    expect(html).toContain("ada@example.com");
    expect(html).toContain('href="/admin/users/u1"');
    expect(html).toContain("superadmin");
    expect(html).toContain("Banned");
    expect(html).toContain("Active");
  });

  test("renders the status badges with success for active and destructive for banned", () => {
    const html = render();
    expect(html).toMatch(/data-variant="success"[^>]*>Active</);
    expect(html).toMatch(/data-variant="destructive"[^>]*>Banned</);
  });

  test("offers no selection column", () => {
    expect(render()).not.toContain('role="checkbox"');
  });

  test("shows the toolbar filters and a sorted header", () => {
    const html = render({ sort: [{ id: "email", desc: false }] });
    expect(html).toContain('aria-label="Table filters"');
    expect(html).toContain('aria-sort="ascending"');
  });

  test("shows the empty state and keeps the toolbar reachable", () => {
    const html = render({ email: "nobody" }, { rows: [], total: 0 });
    expect(html).toContain("No users found.");
    expect(html).toContain('aria-label="Table filters"');
  });

  test("shows the error message", () => {
    const html = render(
      {},
      { rows: undefined, total: undefined, errorMessage: "Could not load users." },
    );
    expect(html).toContain("Could not load users.");
  });
});
