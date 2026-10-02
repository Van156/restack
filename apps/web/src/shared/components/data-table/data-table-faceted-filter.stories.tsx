import type { Meta, StoryObj } from "@storybook/react-vite";

import { useMemberTable } from "./data-table-fixtures";
import { DataTableFacetedFilter } from "./data-table-faceted-filter";

function FacetedExample({
  columnId,
  initialSearch,
}: {
  columnId: "role" | "status";
  initialSearch?: unknown;
}) {
  const { table } = useMemberTable({ initialSearch });
  const column = table.getColumn(columnId);
  if (!column) {
    return null;
  }
  return (
    <DataTableFacetedFilter
      column={column}
      title={column.columnDef.meta?.label ?? columnId}
      options={column.columnDef.meta?.options ?? []}
      multiple={column.columnDef.meta?.variant === "multiSelect"}
    />
  );
}

const meta = {
  title: "App/DataTable/DataTableFacetedFilter",
  component: FacetedExample,
  tags: ["autodocs"],
  args: { columnId: "role" },
} satisfies Meta<typeof FacetedExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MultiSelect: Story = {};

export const MultiSelectWithValues: Story = { args: { initialSearch: { role: "admin,member" } } };

export const SingleSelect: Story = { args: { columnId: "status" } };

export const SingleSelectWithValue: Story = {
  args: { columnId: "status", initialSearch: { status: "suspended" } },
};
