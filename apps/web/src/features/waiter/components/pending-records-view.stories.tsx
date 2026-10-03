import type { Meta, StoryObj } from "@storybook/react-vite";

import PendingRecordsView from "./pending-records-view";

const meta = {
  title: "App/Waiter/PendingRecordsView",
  component: PendingRecordsView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    online: true,
    onRetry: () => {},
    onAuthorize: () => {},
    rows: [
      { key: "a", label: "Agregar 2 × Bandeja", status: "pending", action: null },
      {
        key: "b",
        label: "Anular una línea",
        status: "waiting",
        message: "Esperando la autorización de un Administrador.",
        action: "authorize",
        overrideTarget: "l1",
      },
      {
        key: "c",
        label: "Mover a Mesa 4",
        status: "rejected",
        message: "El servidor lo rechazó: This Table already has an open session.",
        action: "retry",
      },
    ],
  },
} satisfies Meta<typeof PendingRecordsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mixed: Story = {};

export const Offline: Story = { args: { online: false } };

export const Empty: Story = { args: { rows: [] } };
