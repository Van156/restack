import type { Meta, StoryObj } from "@storybook/react-vite";

import TipSharesList from "./tip-shares-list";

const meta = {
  title: "App/Cashier/TipSharesList",
  component: TipSharesList,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    label: "Reparto del turno",
    total: 10_001,
    shares: [
      { key: "m1", displayName: "Ana Ruiz", amount: 5_001 },
      { key: "name:Chef Luis", displayName: "Chef Luis", amount: 5_000 },
    ],
  },
} satisfies Meta<typeof TipSharesList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
