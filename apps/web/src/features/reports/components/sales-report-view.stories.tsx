import type { Meta, StoryObj } from "@storybook/react-vite";

import SalesReportView from "./sales-report-view";

const meta = {
  title: "App/Reports/SalesReportView",
  component: SalesReportView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    view: {
      billCount: 12,
      salesTotal: 1_250_000,
      tipTotal: 120_000,
      collectedTotal: 1_370_000,
      tenders: [
        { tender: "cash", label: "Efectivo", count: 6, amount: 500_000 },
        { tender: "card", label: "Tarjeta", count: 5, amount: 750_000 },
        { tender: "qr_transfer", label: "QR / transferencia", count: 1, amount: 120_000 },
      ],
      documents: {
        total: 12,
        rows: [
          { status: "pending", label: "Pendientes", count: 2 },
          { status: "issued", label: "Emitidos", count: 9 },
          { status: "rejected", label: "Rechazados", count: 1 },
        ],
      },
      locations: [
        { locationId: "a", name: "Centro", billCount: 8, salesTotal: 800_000, tipTotal: 80_000 },
        { locationId: "b", name: "Norte", billCount: 4, salesTotal: 450_000, tipTotal: 40_000 },
      ],
      isEmpty: false,
    },
  },
} satisfies Meta<typeof SalesReportView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OneLocation: Story = {
  args: {
    view: {
      ...meta.args.view,
      locations: [
        {
          locationId: "a",
          name: "Centro",
          billCount: 12,
          salesTotal: 1_250_000,
          tipTotal: 120_000,
        },
      ],
    },
  },
};
