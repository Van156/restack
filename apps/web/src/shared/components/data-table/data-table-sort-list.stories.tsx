import type { Meta, StoryObj } from "@storybook/react-vite";

import { useMemberTable } from "./data-table-fixtures";
import { DataTableSortList } from "./data-table-sort-list";

function SortListExample({
  initialSearch,
  defaultOpen,
}: {
  initialSearch?: unknown;
  defaultOpen?: boolean;
}) {
  const { table } = useMemberTable({ initialSearch, enableAdvancedFilter: true });
  return <DataTableSortList table={table} defaultOpen={defaultOpen} />;
}

const meta = {
  title: "App/DataTable/DataTableSortList",
  component: SortListExample,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof SortListExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const OpenWithDefaultSort: Story = { args: { defaultOpen: true } };

export const OpenUnsorted: Story = { args: { defaultOpen: true, initialSearch: { sort: [] } } };

export const OpenWithMultiSort: Story = {
  args: {
    defaultOpen: true,
    initialSearch: {
      sort: [
        { id: "status", desc: false },
        { id: "score", desc: true },
        { id: "name", desc: false },
      ],
    },
  },
};
