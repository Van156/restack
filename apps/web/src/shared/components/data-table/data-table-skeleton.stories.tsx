import type { Meta, StoryObj } from "@storybook/react-vite";

import { DataTableSkeleton } from "./data-table-skeleton";

const meta = {
  title: "App/DataTable/DataTableSkeleton",
  component: DataTableSkeleton,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { columnCount: 6, rowCount: 5 },
} satisfies Meta<typeof DataTableSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithFilters: Story = { args: { filterCount: 3 } };

export const WithoutToolbarControlsOrPagination: Story = {
  args: { withViewOptions: false, withPagination: false },
};
