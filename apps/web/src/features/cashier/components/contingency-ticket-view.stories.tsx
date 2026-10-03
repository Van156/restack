import type { Meta, StoryObj } from "@storybook/react-vite";

import ContingencyTicketView from "./contingency-ticket-view";

const meta = {
  title: "App/Cashier/ContingencyTicketView",
  component: ContingencyTicketView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    onPrint: () => {},
    ticket: {
      restaurant: { name: "La Fonda del Centro" },
      location: { name: "Sede Centro", address: "Cra 9 # 12-30, Bogotá" },
      cashier: "Ana Pérez",
      soldAt: new Date("2026-10-03T22:05:09Z"),
      buyer: null,
      lines: [
        { id: "1", quantity: 2, name: "Bandeja paisa", unitPrice: 26000, total: 52000 },
        { id: "2", quantity: 1, name: "Limonada de coco", unitPrice: 9000, total: 9000 },
      ],
      taxes: [{ label: "Impoconsumo 8%", amount: 4519 }],
      total: 61000,
      tip: 6100,
      payments: [{ id: "p1", tender: "cash", amount: 67100 }],
    },
  },
} satisfies Meta<typeof ContingencyTicketView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
