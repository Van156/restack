import type { Meta, StoryObj } from "@storybook/react-vite";

import { useMemberTable } from "./data-table-fixtures";
import { DataTableFilterList } from "./data-table-filter-list";

function FilterListExample({
  initialSearch,
  defaultOpen,
}: {
  initialSearch?: unknown;
  defaultOpen?: boolean;
}) {
  const { table, advanced } = useMemberTable({ initialSearch, enableAdvancedFilter: true });
  return <DataTableFilterList table={table} advanced={advanced} defaultOpen={defaultOpen} />;
}

const filters = [
  { id: "name", variant: "text", operator: "iLike", value: "ada", filterId: "filter-1" },
  {
    id: "role",
    variant: "multiSelect",
    operator: "inArray",
    value: ["admin", "member"],
    filterId: "filter-2",
  },
  {
    id: "score",
    variant: "range",
    operator: "isBetween",
    value: ["40", "90"],
    filterId: "filter-3",
  },
];

const meta = {
  title: "App/DataTable/DataTableFilterList",
  component: FilterListExample,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof FilterListExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const OpenEmpty: Story = { args: { defaultOpen: true } };

export const OpenWithFilters: Story = { args: { defaultOpen: true, initialSearch: { filters } } };

export const OpenWithOrJoin: Story = {
  args: { defaultOpen: true, initialSearch: { filters, joinOperator: "or" } },
};

export const OpenWithValuelessAndDateFilters: Story = {
  args: {
    defaultOpen: true,
    initialSearch: {
      filters: [
        { id: "name", variant: "text", operator: "isNotEmpty", value: "", filterId: "filter-1" },
        {
          id: "status",
          variant: "select",
          operator: "ne",
          value: "suspended",
          filterId: "filter-2",
        },
        {
          id: "joinedAt",
          variant: "dateRange",
          operator: "isBetween",
          value: [String(Date.UTC(2024, 0, 1, 12)), String(Date.UTC(2024, 5, 30, 12))],
          filterId: "filter-3",
        },
      ],
    },
  },
};
