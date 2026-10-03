import type { Meta, StoryObj } from "@storybook/react-vite";

import ClosedShiftSummary from "./closed-shift-summary";

const meta = {
  title: "App/Cashier/ClosedShiftSummary",
  component: ClosedShiftSummary,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    expected: { cash: 150_000, card: 80_000, qr_transfer: 30_000 },
    counted: { cash: 150_000, card: 80_000, qr_transfer: 30_000 },
  },
} satisfies Meta<typeof ClosedShiftSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Balanced: Story = {};

export const WithDifference: Story = {
  args: { counted: { cash: 140_000, card: 80_000, qr_transfer: 32_000 } },
};
