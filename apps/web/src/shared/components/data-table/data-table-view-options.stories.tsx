import type { Meta, StoryObj } from "@storybook/react-vite";

import { useMemberTable } from "./data-table-fixtures";
import { DataTableViewOptions } from "./data-table-view-options";

function ViewOptionsExample({ disabled }: { disabled?: boolean }) {
  const { table } = useMemberTable();
  return <DataTableViewOptions table={table} disabled={disabled} />;
}

const meta = {
  title: "App/DataTable/DataTableViewOptions",
  component: ViewOptionsExample,
  tags: ["autodocs"],
} satisfies Meta<typeof ViewOptionsExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = { args: { disabled: true } };
