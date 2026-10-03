import type { Meta, StoryObj } from "@storybook/react-vite";

import PendingChargesView from "./pending-charges-view";

const meta = {
  title: "App/Cashier/PendingChargesView",
  component: PendingChargesView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    online: true,
    onRetry: () => {},
    checklist: [
      { id: "payments", label: "Cobros por enviar al servidor", count: 1, done: false },
      { id: "documents", label: "Documentos por transmitir a la DIAN", count: 1, done: false },
      { id: "rejected", label: "Registros rechazados por revisar", count: 1, done: false },
    ],
    rows: [
      {
        key: "p1",
        kind: "payment",
        title: "Efectivo $ 20.000 · Mesa 3",
        detail: null,
        status: "pending",
        saleTime: "2026-10-03T18:00:00.000Z",
        canRetry: false,
      },
      {
        key: "d1",
        kind: "document",
        title: "Documento para la DIAN · Mesa 3",
        detail: "Sin conexión con el servidor: se reintenta solo.",
        status: "failed",
        saleTime: "2026-10-03T18:05:00.000Z",
        canRetry: true,
      },
      {
        key: "p2",
        kind: "payment",
        title: "Tarjeta $ 35.000 · Mesa 5",
        detail: "El pago supera el saldo pendiente.",
        status: "rejected",
        saleTime: "2026-10-03T18:30:00.000Z",
        canRetry: true,
      },
    ],
  },
} satisfies Meta<typeof PendingChargesView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    rows: [],
    checklist: [
      { id: "payments", label: "Cobros por enviar al servidor", count: 0, done: true },
      { id: "documents", label: "Documentos por transmitir a la DIAN", count: 0, done: true },
      { id: "rejected", label: "Registros rechazados por revisar", count: 0, done: true },
    ],
  },
};
