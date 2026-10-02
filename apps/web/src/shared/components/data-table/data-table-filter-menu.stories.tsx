import type { Meta, StoryObj } from "@storybook/react-vite";

import { useMemberTable } from "./data-table-fixtures";
import { DataTableFilterMenu } from "./data-table-filter-menu";

function FilterMenuExample({
  initialSearch,
  defaultOpen,
}: {
  initialSearch?: unknown;
  defaultOpen?: boolean;
}) {
  const { table, advanced } = useMemberTable({ initialSearch, enableAdvancedFilter: true });
  return <DataTableFilterMenu table={table} advanced={advanced} defaultOpen={defaultOpen} />;
}

const meta = {
  title: "App/DataTable/DataTableFilterMenu",
  component: FilterMenuExample,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof FilterMenuExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const Open: Story = { args: { defaultOpen: true } };

export const WithFilters: Story = {
  args: {
    initialSearch: {
      filters: [
        { id: "name", variant: "text", operator: "iLike", value: "ada", filterId: "filter-1" },
        {
          id: "role",
          variant: "multiSelect",
          operator: "inArray",
          value: ["admin"],
          filterId: "filter-2",
        },
        {
          id: "status",
          variant: "select",
          operator: "eq",
          value: "active",
          filterId: "filter-3",
        },
      ],
    },
  },
};
