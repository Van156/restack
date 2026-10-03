import type { Meta, StoryObj } from "@storybook/react-vite";

import TableSessionView from "./table-session-view";

const meta = {
  title: "App/Waiter/TableSessionView",
  component: TableSessionView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    tableName: "3",
    billRequested: false,
    busy: false,
    errorMessage: null,
    onBack: () => {},
    onAddItem: () => {},
    onSend: () => {},
    onRequestBill: () => {},
    onMove: () => {},
    onRemoveLine: () => {},
    onVoidLine: () => {},
    onDiscount: () => {},
    order: {
      hasUnsent: true,
      total: 68_000,
      lines: [
        {
          id: "l1",
          idempotencyKey: "k1",
          quantity: 2,
          name: "Bandeja paisa",
          modifiers: ["Sin chicharrón"],
          note: null,
          state: "sent",
          total: 50_000,
        },
        {
          id: "l2",
          idempotencyKey: "k2",
          quantity: 1,
          name: "Limonada",
          modifiers: [],
          note: "Poco hielo",
          state: "unsent",
          total: 8_000,
        },
        {
          id: "l3",
          idempotencyKey: "k3",
          quantity: 1,
          name: "Postre",
          modifiers: [],
          note: null,
          state: "voided",
          total: 10_000,
        },
      ],
    },
  },
} satisfies Meta<typeof TableSessionView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const UnroutedError: Story = {
  args: {
    errorMessage:
      "Estos productos no tienen estación en este local: Limonada. Pide a un administrador que los asigne.",
  },
};
