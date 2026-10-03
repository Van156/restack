import type { Meta, StoryObj } from "@storybook/react-vite";

import ShiftLedgerView from "./shift-ledger-view";

const meta = {
  title: "App/Cashier/ShiftLedgerView",
  component: ShiftLedgerView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    ledger: {
      shiftId: "sh1",
      openingAmount: 100_000,
      openedAt: "2026-10-03T13:00:00.000Z",
      takings: {
        cash: { amount: 50_000, count: 2 },
        card: { amount: 80_000, count: 3 },
        qr_transfer: { amount: 30_000, count: 1 },
      },
      tips: 16_000,
      changeGiven: 2_000,
      expected: { cash: 150_000, card: 80_000, qr_transfer: 30_000, total: 260_000 },
    },
    takings: [],
  },
} satisfies Meta<typeof ShiftLedgerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithOfflineTakings: Story = {
  args: {
    takings: [
      {
        id: "t1",
        tender: "card",
        amount: 35_000,
        reference: "0045",
        saleTime: "2026-10-03T18:30:00.000Z",
      },
      {
        id: "t2",
        tender: "cash",
        amount: 20_000,
        reference: null,
        saleTime: "2026-10-03T19:10:00.000Z",
      },
    ],
  },
};
