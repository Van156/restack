import { Button } from "@base-template/ui/components/button";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DownloadIcon, UsersIcon } from "lucide-react";

import { DataTable } from "./data-table";
import { DataTableActionBar } from "./data-table-action-bar";
import { memberRows, useMemberTable } from "./data-table-fixtures";
import { DataTableAdvancedToolbar } from "./data-table-advanced-toolbar";
import { DataTableFilterList } from "./data-table-filter-list";
import { DataTableFilterMenu } from "./data-table-filter-menu";
import { DataTableSortList } from "./data-table-sort-list";
import { DataTableToolbar } from "./data-table-toolbar";

type ExampleProps = {
  initialSearch?: unknown;
  initialRowSelection?: Record<string, true>;
  source?: typeof memberRows;
  isPending?: boolean;
  errorMessage?: string | null;
  /** Shows the rows while the last refetch failed. */
  isFetching?: boolean;
  /** Advanced mode: a filter list or a filter menu in the advanced toolbar, optionally with the sort list. */
  advancedFilter?: "list" | "menu";
  sortList?: boolean;
};

/** A member list bound to in-memory search state; a feature binds it to the route search instead. */
function DataTableExample({
  initialSearch,
  initialRowSelection,
  source,
  isPending,
  errorMessage,
  isFetching,
  advancedFilter,
  sortList,
}: ExampleProps) {
  const { table, advanced, total } = useMemberTable({
    initialSearch,
    initialRowSelection,
    source,
    enableAdvancedFilter: advancedFilter !== undefined,
  });
  return (
    <DataTable
      table={table}
      total={total}
      isPending={isPending}
      errorMessage={errorMessage}
      onRetry={() => {}}
      isFetching={isFetching}
      empty={{
        title: "No members found",
        description: "Try changing or resetting the filters.",
        icon: <UsersIcon />,
      }}
      actionBar={
        <DataTableActionBar
          selectedCount={Object.keys(table.state.rowSelection).length}
          onClearSelection={() => table.resetRowSelection()}
        >
          <Button size="sm" variant="outline">
            <DownloadIcon />
            Export
          </Button>
        </DataTableActionBar>
      }
    >
      {advancedFilter ? (
        <DataTableAdvancedToolbar table={table}>
          {advancedFilter === "list" ? (
            <DataTableFilterList table={table} advanced={advanced} />
          ) : (
            <DataTableFilterMenu table={table} advanced={advanced} />
          )}
          {sortList ? <DataTableSortList table={table} /> : null}
        </DataTableAdvancedToolbar>
      ) : (
        <DataTableToolbar table={table} />
      )}
    </DataTable>
  );
}

const meta = {
  title: "App/DataTable/DataTable",
  component: DataTableExample,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof DataTableExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = { args: { isPending: true } };

export const Empty: Story = { args: { source: [] } };

export const FilteredToNothing: Story = { args: { initialSearch: { name: "no such member" } } };

export const Error: Story = { args: { source: [], errorMessage: "Could not load members." } };

export const RefetchError: Story = {
  args: { errorMessage: "Could not refresh members. Showing the last loaded page." },
};

export const OutOfRange: Story = {
  args: { source: memberRows, initialSearch: { page: 4, perPage: 10 } },
};

export const WithSelection: Story = {
  args: { initialRowSelection: { "member-1": true, "member-2": true } },
};

export const SecondPageSortedAndFiltered: Story = {
  args: {
    initialSearch: {
      page: 2,
      perPage: 10,
      sort: [{ id: "score", desc: true }],
      role: "member,viewer",
    },
  },
};

const advancedFilters = [
  { id: "status", variant: "select", operator: "eq", value: "active", filterId: "filter-1" },
  { id: "score", variant: "number", operator: "gt", value: "40", filterId: "filter-2" },
];

export const AdvancedFilterList: Story = {
  args: { advancedFilter: "list", initialSearch: { filters: advancedFilters } },
};

export const AdvancedFilterMenu: Story = {
  args: { advancedFilter: "menu", initialSearch: { filters: advancedFilters } },
};

export const WithSortList: Story = {
  args: {
    advancedFilter: "list",
    sortList: true,
    initialSearch: {
      filters: advancedFilters,
      sort: [
        { id: "status", desc: false },
        { id: "score", desc: true },
      ],
    },
  },
};
