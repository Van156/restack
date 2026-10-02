import { Table, TableHead, TableHeader, TableRow } from "@base-template/ui/components/table";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FlexRender } from "@tanstack/react-table";

import { toAriaSort } from "@/shared/lib/data-table/table-state";

import { useMemberTable } from "./data-table-fixtures";

/** The header cells of the member table, so `aria-sort` sits on the `th` as in `DataTable`. */
function HeaderExample({ initialSearch }: { initialSearch?: unknown }) {
  const { table } = useMemberTable({ initialSearch });
  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers
              .filter((header) => header.column.id !== "select")
              .map((header) => (
                <TableHead
                  key={header.id}
                  aria-sort={toAriaSort(header.column.getIsSorted(), header.column.getCanSort())}
                >
                  <FlexRender header={header} />
                </TableHead>
              ))}
          </TableRow>
        ))}
      </TableHeader>
    </Table>
  );
}

const meta = {
  title: "App/DataTable/DataTableColumnHeader",
  component: HeaderExample,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof HeaderExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SortedDescending: Story = {
  args: { initialSearch: { sort: [{ id: "score", desc: true }] } },
};
