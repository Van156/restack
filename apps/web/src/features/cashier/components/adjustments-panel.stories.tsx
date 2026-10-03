import type { Meta, StoryObj } from "@storybook/react-vite";

import AdjustmentsPanel from "./adjustments-panel";

const meta = {
  title: "App/Cashier/AdjustmentsPanel",
  component: AdjustmentsPanel,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    lines: [
      { id: "a", name: "Bandeja paisa", quantity: 2 },
      { id: "b", name: "Limonada de coco", quantity: 1 },
    ],
    settled: false,
    online: true,
    busy: false,
    onDiscount: () => {},
    onVoid: () => {},
    onReopen: () => {},
  },
} satisfies Meta<typeof AdjustmentsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BeforeCharging: Story = {};

export const AfterCharging: Story = { args: { settled: true } };

export const Offline: Story = { args: { online: false } };
