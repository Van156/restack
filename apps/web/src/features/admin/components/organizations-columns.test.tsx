import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";

import { organizationsSearchConfig, organizationsSearchSchema } from "../lib/organizations-search";
import { getOrganizationsColumns } from "./organizations-columns";
import type { OrganizationsTableRow } from "./organizations-columns";

const rows: OrganizationsTableRow[] = [
  {
    id: "o1",
    name: "Acme Rockets",
    slug: "acme-rockets",
    memberCount: 3,
    createdAt: new Date("2026-01-02T00:00:00Z"),
  },
];

function render(search: unknown = {}) {
  return renderToStaticMarkup(
    <SimpleListTable
      search={organizationsSearchSchema.parse(search)}
      searchConfig={organizationsSearchConfig}
      onSearchChange={() => {}}
      columns={getOrganizationsColumns()}
      emptyTitle="No organizations found."
      list={{
        rows,
        total: 1,
        isPending: false,
        isFetching: false,
        isPlaceholderData: false,
        errorMessage: null,
        onRetry: () => {},
      }}
    />,
  );
}

describe("organizations columns", () => {
  const columns = getOrganizationsColumns();

  test("filterable columns are the search config's filter keys", () => {
    expect(columns.filter((column) => column.enableColumnFilter).map((c) => c.id)).toEqual([
      ...organizationsSearchConfig.filterableColumnIds,
    ]);
  });

  test("the member count is not sortable; the other sort columns are", () => {
    expect(columns.filter((column) => column.enableSorting !== false).map((c) => c.id)).toEqual([
      ...organizationsSearchConfig.columnIds,
    ]);
  });
});

describe("SimpleListTable (organizations)", () => {
  test("renders name, slug, member count and a descending created header by default", () => {
    const html = render();
    expect(html).toContain("Acme Rockets");
    expect(html).toContain("acme-rockets");
    expect(html).toContain(">3<");
    expect(html).toContain('aria-sort="descending"');
  });
});
