import { Button } from "@base-template/ui/components/button";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DownloadIcon, Trash2Icon } from "lucide-react";

import { DataTableActionBar } from "./data-table-action-bar";

const meta = {
  title: "App/DataTable/DataTableActionBar",
  component: DataTableActionBar,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { selectedCount: 3, onClearSelection: () => {} },
} satisfies Meta<typeof DataTableActionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActions: Story = {
  args: {
    children: (
      <>
        <Button size="sm" variant="outline">
          <DownloadIcon />
          Export
        </Button>
        <Button size="sm" variant="destructive">
          <Trash2Icon />
          Delete
        </Button>
      </>
    ),
  },
};
