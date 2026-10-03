import type { Meta, StoryObj } from "@storybook/react-vite";

import OutboxView from "./outbox-view";

const meta = {
  title: "App/Dian/OutboxView",
  component: OutboxView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    retryingId: null,
    onRetry: () => {},
    rows: [
      {
        documentId: "d1",
        kindLabel: "Documento equivalente POS",
        saleTime: new Date("2026-10-03T13:00:00.000Z"),
        contingency: true,
        attempts: 2,
        deadlineText: "Quedan 1 d 12 h",
        nextAttemptText: "En 5 min",
        overdue: false,
        lastError: "Proveedor sin conexión",
      },
      {
        documentId: "d2",
        kindLabel: "Factura electrónica",
        saleTime: new Date("2026-10-01T13:00:00.000Z"),
        contingency: false,
        attempts: 9,
        deadlineText: "Venció hace 2 h",
        nextAttemptText: "Ahora",
        overdue: true,
        lastError: null,
      },
    ],
  },
} satisfies Meta<typeof OutboxView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
