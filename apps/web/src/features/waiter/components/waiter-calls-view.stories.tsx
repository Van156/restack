import type { Meta, StoryObj } from "@storybook/react-vite";

import WaiterCallsView from "./waiter-calls-view";

const meta = {
  title: "App/Waiter/WaiterCallsView",
  component: WaiterCallsView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    online: true,
    busy: false,
    onAcknowledge: () => {},
    onResolve: () => {},
    rows: [
      {
        id: "c1",
        tableName: "4",
        reasonLabel: "Quiere pagar",
        statusLabel: "Esperando",
        ageMs: 95_000,
        canAcknowledge: true,
      },
      {
        id: "c2",
        tableName: "7",
        reasonLabel: "Necesita algo",
        statusLabel: "En camino",
        ageMs: 30_000,
        canAcknowledge: false,
      },
    ],
  },
} satisfies Meta<typeof WaiterCallsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Waiting: Story = {};

export const Offline: Story = { args: { online: false } };

export const Quiet: Story = { args: { rows: [] } };
