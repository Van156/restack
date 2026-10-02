import type { Meta, StoryObj } from "@storybook/react-vite";

import { useMemberTable } from "./data-table-fixtures";
import { DataTableDateFilter } from "./data-table-date-filter";

function DateExample({ multiple, initialSearch }: { multiple?: boolean; initialSearch?: unknown }) {
  const { table } = useMemberTable({ initialSearch });
  const column = table.getColumn("joinedAt");
  return column ? <DataTableDateFilter column={column} title="Joined" multiple={multiple} /> : null;
}

const meta = {
  title: "App/DataTable/DataTableDateFilter",
  component: DateExample,
  tags: ["autodocs"],
} satisfies Meta<typeof DateExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleDate: Story = {};

export const DateRange: Story = { args: { multiple: true } };

export const DateRangeWithValue: Story = {
  args: {
    multiple: true,
    initialSearch: { joinedAt: `${Date.UTC(2024, 0, 15)},${Date.UTC(2024, 5, 30)}` },
  },
};
