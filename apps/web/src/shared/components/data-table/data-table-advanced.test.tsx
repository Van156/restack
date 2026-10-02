import { describe, expect, test } from "bun:test";
import { Sortable, SortableContent } from "@base-template/ui/components/sortable";
import { renderToStaticMarkup } from "react-dom/server";

import type { FilterBuilderColumn } from "@/shared/lib/data-table/features";
import type { ColumnFilter, ColumnSort } from "@/shared/lib/data-table/types";

import { getFilterBuilderColumns, getSortBuilderColumns } from "@/shared/lib/data-table/features";

import { DataTableAdvancedToolbar } from "./data-table-advanced-toolbar";
import { useMemberTable } from "./data-table-fixtures";
import { DataTableFilterItem } from "./data-table-filter-item";
import { DataTableFilterList } from "./data-table-filter-list";
import { DataTableFilterMenu } from "./data-table-filter-menu";
import { DataTableSortItem } from "./data-table-sort-item";
import { DataTableSortList } from "./data-table-sort-list";

type HarnessProps = { search?: unknown; part: "toolbar" | "list" | "menu" | "sort" };

function Harness({ search = {}, part }: HarnessProps) {
  const { table, advanced } = useMemberTable({ initialSearch: search, enableAdvancedFilter: true });
  if (part === "menu") {
    return <DataTableFilterMenu table={table} advanced={advanced} />;
  }
  if (part === "list") {
    return <DataTableFilterList table={table} advanced={advanced} />;
  }
  if (part === "sort") {
    return <DataTableSortList table={table} />;
  }
  return (
    <DataTableAdvancedToolbar table={table}>
      <DataTableFilterList table={table} advanced={advanced} />
      <DataTableSortList table={table} />
    </DataTableAdvancedToolbar>
  );
}

const render = (props: HarnessProps) => renderToStaticMarkup(<Harness {...props} />);

const filters: ColumnFilter[] = [
  { id: "name", variant: "text", operator: "iLike", value: "ada", filterId: "filter-1" },
  {
    id: "role",
    variant: "multiSelect",
    operator: "inArray",
    value: ["admin", "member"],
    filterId: "filter-2",
  },
  { id: "status", variant: "select", operator: "isEmpty", value: "", filterId: "filter-3" },
];

describe("DataTableAdvancedToolbar", () => {
  test("renders its children, the view options and an accessible toolbar", () => {
    const html = render({ part: "toolbar" });
    expect(html).toContain('role="toolbar"');
    expect(html).toContain('aria-label="Table filters and sorting"');
    expect(html).toContain(">Filter<");
    expect(html).toContain(">Sort<");
    expect(html).toContain("View");
  });

  test("the triggers carry the number of filters and sort items from the search", () => {
    const html = render({
      part: "toolbar",
      search: {
        filters,
        sort: [
          { id: "score", desc: true },
          { id: "name", desc: false },
        ],
      },
    });
    // Filter trigger badge (3 filters) and Sort trigger badge (2 sort items).
    expect(html).toMatch(/Filter<span[^>]*>3<\/span>/);
    expect(html).toMatch(/Sort<span[^>]*>2<\/span>/);
  });
});

describe("DataTableFilterList trigger", () => {
  test("shows no count without filters", () => {
    expect(render({ part: "list" })).not.toMatch(/Filter<span/);
  });

  test("drops URL filters without a filterId instead of showing them", () => {
    const withoutId = filters.map(({ filterId: _filterId, ...rest }) => rest);
    expect(render({ part: "list", search: { filters: withoutId } })).not.toMatch(/Filter<span/);
  });

  test("the count includes only complete filters from the URL", () => {
    const html = render({
      part: "list",
      search: { filters: [...filters, { ...filters[0], filterId: "filter-4", value: "" }] },
    });
    expect(html).toMatch(/Filter<span[^>]*>3<\/span>/);
  });
});

describe("DataTableFilterMenu", () => {
  test("renders a chip per filter from the search", () => {
    const html = render({ part: "menu", search: { filters } });
    expect(html.match(/role="listitem"/g)).toHaveLength(3);
    expect(html).toContain("Remove Name filter");
    expect(html).toContain("Remove Role filter");
    expect(html).toContain("Remove Status filter");
    expect(html).toContain('value="ada"');
    expect(html).toContain("Contains");
    expect(html).toContain("Has any of");
    expect(html).toContain("No value needed");
  });

  test("offers a reset and collapses the trigger to an icon once there are filters", () => {
    const html = render({ part: "menu", search: { filters } });
    expect(html).toContain('aria-label="Reset all filters"');
    expect(html).toContain('aria-label="Open filter command menu"');
    expect(html).not.toContain(">Filter<");
  });

  test("without filters it shows the labelled Filter button and no reset", () => {
    const html = render({ part: "menu" });
    expect(html).toContain("Filter");
    expect(html).not.toContain("Reset all filters");
    expect(html).not.toContain('role="listitem"');
  });
});

const columns = (() => {
  let captured: FilterBuilderColumn[] = [];
  let sortColumns: { id: string; label: string }[] = [];
  function Capture() {
    const { table } = useMemberTable({ enableAdvancedFilter: true });
    captured = getFilterBuilderColumns(table);
    sortColumns = getSortBuilderColumns(table);
    return null;
  }
  renderToStaticMarkup(<Capture />);
  return { filter: captured, sort: sortColumns };
})();

function renderItem(filter: ColumnFilter, index: number) {
  const column = columns.filter.find((candidate) => candidate.id === filter.id);
  if (!column) {
    throw new Error(`no column ${filter.id}`);
  }
  return renderToStaticMarkup(
    <Sortable value={[filter]} getItemValue={(item) => item.filterId}>
      <SortableContent>
        <DataTableFilterItem
          filter={filter}
          column={column}
          columns={columns.filter}
          index={index}
          itemId="row"
          joinOperator="or"
          onJoinOperatorChange={() => {}}
          onUpdate={() => {}}
          onColumnChange={() => {}}
          onRemove={() => {}}
        />
      </SortableContent>
    </Sortable>,
  );
}

describe("builder columns", () => {
  test("filter columns are the filterable ones with label and variant", () => {
    expect(columns.filter.map((column) => [column.id, column.label, column.variant])).toEqual([
      ["name", "Name", "text"],
      ["role", "Role", "multiSelect"],
      ["status", "Status", "select"],
      ["score", "Score", "range"],
      ["joinedAt", "Joined", "dateRange"],
    ]);
  });

  test("sort columns exclude the selection column", () => {
    const ids = columns.sort.map((column) => column.id);
    expect(ids).not.toContain("select");
    expect(ids).toContain("score");
  });
});

describe("DataTableFilterItem", () => {
  test("the first row starts with Where and every control is labelled", () => {
    const html = renderItem(filters[0]!, 0);
    expect(html).toContain("Where");
    expect(html).toContain('aria-label="Filter field, Name"');
    expect(html).toContain('aria-label="Name filter operator"');
    expect(html).toContain('aria-label="Name filter value"');
    expect(html).toContain('aria-label="Remove Name filter"');
    expect(html).toContain('aria-label="Reorder Name filter"');
    expect(html).toContain('value="ada"');
  });

  test("the second row holds the join operator select, later rows just repeat it", () => {
    const second = renderItem(filters[0]!, 1);
    expect(second).toContain('aria-label="Join operator"');
    expect(second).toContain(">or<");
    const third = renderItem(filters[0]!, 2);
    expect(third).not.toContain('aria-label="Join operator"');
    expect(third).toContain(">or<");
  });

  test("a multi select row shows the selected options as badges", () => {
    const html = renderItem(filters[1]!, 0);
    expect(html).toContain('aria-label="Role filter values"');
    expect(html).toContain(">Admin<");
    expect(html).toContain(">Member<");
  });

  test("an isBetween range row shows two labelled number inputs", () => {
    const html = renderItem(
      { id: "score", variant: "range", operator: "isBetween", value: ["20", "80"], filterId: "f" },
      0,
    );
    expect(html).toContain('aria-label="Score minimum value"');
    expect(html).toContain('aria-label="Score maximum value"');
    expect(html).toContain('value="20"');
    expect(html).toContain('value="80"');
  });

  test("a date range row shows the formatted dates", () => {
    const html = renderItem(
      {
        id: "joinedAt",
        variant: "dateRange",
        operator: "isBetween",
        value: [String(Date.UTC(2024, 0, 15, 12)), String(Date.UTC(2024, 5, 20, 12))],
        filterId: "f",
      },
      0,
    );
    expect(html).toContain('aria-label="Joined date filter"');
    expect(html).toContain("Jan 15, 2024 - Jun 20, 2024");
  });

  test("an unfinished date row asks for a date", () => {
    const html = renderItem(
      { id: "joinedAt", variant: "dateRange", operator: "gte", value: "", filterId: "f" },
      0,
    );
    expect(html).toContain("Pick a date");
  });
});

describe("DataTableSortList", () => {
  test("the trigger shows no count without sort items", () => {
    expect(render({ part: "sort", search: { sort: [] } })).not.toMatch(/Sort<span/);
  });

  test("the trigger counts the sort items from the search", () => {
    const html = render({
      part: "sort",
      search: {
        sort: [
          { id: "status", desc: false },
          { id: "score", desc: true },
          { id: "name", desc: false },
        ],
      },
    });
    expect(html).toMatch(/Sort<span[^>]*>3<\/span>/);
  });

  test("a sort row names its field and direction and has labelled controls", () => {
    const sort: ColumnSort = { id: "score", desc: true };
    const html = renderToStaticMarkup(
      <Sortable value={[sort]} getItemValue={(item) => item.id}>
        <SortableContent>
          <DataTableSortItem
            sort={sort}
            label="Score"
            fieldOptions={columns.sort}
            onUpdate={() => {}}
            onRemove={() => {}}
          />
        </SortableContent>
      </Sortable>,
    );
    expect(html).toContain('aria-label="Sort field, Score"');
    expect(html).toContain('aria-label="Score sort direction"');
    expect(html).toContain(">Desc<");
    expect(html).toContain('aria-label="Remove Score sort"');
    expect(html).toContain('aria-label="Reorder Score sort"');
  });
});
