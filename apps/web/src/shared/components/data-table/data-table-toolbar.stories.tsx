import { Button } from "@base-template/ui/components/button";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PlusIcon } from "lucide-react";

import { useMemberTable } from "./data-table-fixtures";
import { DataTableToolbar } from "./data-table-toolbar";

function ToolbarExample({
  initialSearch,
  withActions,
}: {
  initialSearch?: unknown;
  withActions?: boolean;
}) {
  const { table } = useMemberTable({ initialSearch });
  return (
    <DataTableToolbar table={table}>
      {withActions ? (
        <Button size="sm">
          <PlusIcon />
          Invite
        </Button>
      ) : null}
    </DataTableToolbar>
  );
}

const meta = {
  title: "App/DataTable/DataTableToolbar",
  component: ToolbarExample,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof ToolbarExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActiveFilters: Story = {
  args: { initialSearch: { name: "ada", role: "admin,member", status: "active", score: "20,80" } },
};

export const WithActions: Story = { args: { withActions: true } };
