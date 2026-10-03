import type { Meta, StoryObj } from "@storybook/react-vite";

import OfflineSaleSection from "./offline-sale-section";

const ticket = {
  restaurant: { name: "La Fonda del Centro" },
  location: { name: "Sede Centro" },
  cashier: "Ana Pérez",
  soldAt: new Date("2026-10-03T22:05:09Z"),
  buyer: null,
  lines: [{ id: "1", quantity: 2, name: "Bandeja paisa", unitPrice: 26000, total: 52000 }],
  taxes: [{ label: "Impoconsumo 8%", amount: 3852 }],
  total: 52000,
  tip: 5200,
  payments: [{ id: "p1", tender: "cash" as const, amount: 57200 }],
};

const meta = {
  title: "App/Cashier/OfflineSaleSection",
  component: OfflineSaleSection,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    dianEnabled: true,
    documentQueued: false,
    ticket,
    busy: false,
    blockedReason: null,
    onRequestDocument: () => {},
    onPrint: () => {},
  },
} satisfies Meta<typeof OfflineSaleSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AskForTicket: Story = {};

export const TicketReady: Story = { args: { documentQueued: true } };

export const Blocked: Story = {
  args: {
    blockedReason:
      "Llevas más de 48 horas sin conexión: las ventas de contingencia están bloqueadas.",
  },
};

export const ExemptLocation: Story = { args: { dianEnabled: false } };
