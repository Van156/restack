import type { Meta, StoryObj } from "@storybook/react-vite";

import { ContingencyTicket } from "@base-template/ui/components/contingency-ticket";

const meta = {
  title: "UI/Restaurant/Contingency ticket",
  component: ContingencyTicket,
  tags: ["autodocs"],
  args: {
    restaurant: {
      name: "La Fonda del Centro",
      nit: "900.123.456-7",
      address: "Cra 7 # 10-20, Bogotá",
    },
    number: "CT-000123",
    soldAt: new Date("2026-10-03T22:05:09Z"),
    lines: [
      { id: "1", quantity: 2, name: "Bandeja paisa", unitPrice: 26000, total: 52000 },
      { id: "2", quantity: 1, name: "Limonada de coco", unitPrice: 9000, total: 9000 },
    ],
    taxes: [{ label: "Impoconsumo 8%", amount: 4519 }],
    total: 61000,
    tip: 6100,
    payments: [{ id: "p1", tender: "cash", amount: 67100 }],
  },
} satisfies Meta<typeof ContingencyTicket>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FinalConsumer: Story = {};

export const WithBuyer: Story = {
  args: { buyer: { name: "Ana Ruiz", documentNumber: "1.020.304.050" } },
};

export const SplitPayment: Story = {
  args: {
    payments: [
      { id: "p1", tender: "card", amount: 40000 },
      { id: "p2", tender: "qr_transfer", amount: 27100 },
    ],
  },
};

export const WithoutNumber: Story = { args: { number: null } };
