import type { Meta, StoryObj } from "@storybook/react-vite";

import FreeTableView from "./free-table-view";

const meta = {
  title: "App/Waiter/FreeTableView",
  component: FreeTableView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    tableName: "3",
    busy: false,
    errorMessage: null,
    onBack: () => {},
    onOpen: () => {},
  },
} satisfies Meta<typeof FreeTableView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Opening: Story = { args: { busy: true } };

export const Failed: Story = { args: { errorMessage: "Esta mesa ya tiene una cuenta abierta." } };
