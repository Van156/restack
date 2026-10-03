import type { Meta, StoryObj } from "@storybook/react-vite";

import { OrderStrip } from "@base-template/ui/components/order-strip";

const meta = {
  title: "UI/Restaurant/Order strip",
  component: OrderStrip,
  tags: ["autodocs"],
  args: {
    lines: [
      { id: "1", quantity: 2, name: "Bandeja paisa", state: "sent", total: 52000 },
      {
        id: "2",
        quantity: 1,
        name: "Hamburguesa",
        modifiers: ["Doble carne", "Sin tomate"],
        note: "Término medio",
        state: "unsent",
        total: 31500,
      },
      { id: "3", quantity: 1, name: "Limonada de coco", state: "voided", total: 9000 },
    ],
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OrderStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OnlyUnsent: Story = {
  args: { lines: [{ id: "1", quantity: 1, name: "Café", state: "unsent", total: 4500 }] },
};

export const Empty: Story = { args: { lines: [] } };
