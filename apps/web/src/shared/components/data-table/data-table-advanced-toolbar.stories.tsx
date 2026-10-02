import { Button } from "@base-template/ui/components/button";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PlusIcon } from "lucide-react";

import { DataTableAdvancedToolbar } from "./data-table-advanced-toolbar";
import { useMemberTable } from "./data-table-fixtures";
import { DataTableFilterList } from "./data-table-filter-list";
import { DataTableSortList } from "./data-table-sort-list";

function AdvancedToolbarExample({
  initialSearch,
  withActions,
}: {
  initialSearch?: unknown;
  withActions?: boolean;
}) {
  const { table, advanced } = useMemberTable({ initialSearch, enableAdvancedFilter: true });
  return (
    <DataTableAdvancedToolbar table={table}>
      <DataTableFilterList table={table} advanced={advanced} />
      <DataTableSortList table={table} />
      {withActions ? (
        <Button size="sm">
          <PlusIcon />
          Invite
        </Button>
      ) : null}
    </DataTableAdvancedToolbar>
  );
}

const meta = {
  title: "App/DataTable/DataTableAdvancedToolbar",
  component: AdvancedToolbarExample,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof AdvancedToolbarExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithFiltersAndSort: Story = {
  args: {
    initialSearch: {
      filters: [
        {
          id: "status",
          variant: "select",
          operator: "eq",
          value: "active",
          filterId: "filter-1",
        },
      ],
      sort: [
        { id: "score", desc: true },
        { id: "name", desc: false },
      ],
    },
  },
};

export const WithActions: Story = { args: { withActions: true } };
