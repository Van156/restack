import type { Meta, StoryObj } from "@storybook/react-vite";

import CheckoutRowsView from "./checkout-rows-view";

const meta = {
  title: "App/Cashier/CheckoutRowsView",
  component: CheckoutRowsView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    onSelect: () => {},
    rows: [
      { sessionId: "s2", tableName: "2", areaName: "Salón", billRequested: true },
      { sessionId: "s1", tableName: "1", areaName: "Salón", billRequested: false },
      { sessionId: "s3", tableName: "T1", areaName: "Terraza", billRequested: false },
    ],
  },
} satisfies Meta<typeof CheckoutRowsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { rows: [] } };
