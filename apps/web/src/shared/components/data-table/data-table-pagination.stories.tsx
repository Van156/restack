import type { Meta, StoryObj } from "@storybook/react-vite";

import { useMemberTable } from "./data-table-fixtures";
import { DataTablePagination } from "./data-table-pagination";

function PaginationExample({
  initialSearch,
  initialRowSelection,
  disabled,
}: {
  initialSearch?: unknown;
  initialRowSelection?: Record<string, true>;
  disabled?: boolean;
}) {
  const { table } = useMemberTable({ initialSearch, initialRowSelection });
  return <DataTablePagination table={table} disabled={disabled} />;
}

const meta = {
  title: "App/DataTable/DataTablePagination",
  component: PaginationExample,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof PaginationExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstPage: Story = {};

export const MiddlePage: Story = { args: { initialSearch: { page: 3, perPage: 10 } } };

export const WithSelection: Story = {
  args: { initialRowSelection: { "member-1": true, "member-2": true, "member-3": true } },
};

export const Disabled: Story = { args: { disabled: true } };
