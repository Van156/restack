import type { Meta, StoryObj } from "@storybook/react-vite";

import { BillLedger } from "@base-template/ui/components/bill-ledger";

const meta = {
  title: "UI/Restaurant/Bill ledger",
  component: BillLedger,
  tags: ["autodocs"],
  args: {
    lines: [
      { id: "1", quantity: 2, name: "Bandeja paisa", base: 48148, tax: 3852, total: 52000 },
      { id: "2", quantity: 1, name: "Limonada de coco", base: 8333, tax: 667, total: 9000 },
    ],
    taxes: [{ label: "Impoconsumo 8%", amount: 4519 }],
    discountTotal: 0,
    total: 61000,
    tip: 6100,
    payments: [],
    balanceDue: 67100,
  },
  decorators: [
    (Story) => (
      <div className="w-[34rem]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BillLedger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const WithDiscount: Story = {
  args: { discountTotal: 6100, total: 54900, tip: 5490, balanceDue: 60390 },
};

export const NoTip: Story = { args: { tip: 0, balanceDue: 61000 } };

export const SplitPayments: Story = {
  args: {
    payments: [
      { id: "p1", tender: "card", amount: 40000, change: 0, reference: "A4821" },
      { id: "p2", tender: "cash", amount: 27100, change: 2900 },
    ],
    balanceDue: 0,
  },
};

export const PartlyPaid: Story = {
  args: {
    payments: [{ id: "p1", tender: "qr_transfer", amount: 30000, change: 0, reference: "M77201" }],
    balanceDue: 37100,
  },
};

export const RegisteredOffline: Story = {
  args: {
    payments: [
      {
        id: "p1",
        tender: "card",
        amount: 67100,
        change: 0,
        reference: "A4822",
        registeredOffline: true,
      },
    ],
    balanceDue: 0,
  },
};

export const Overpaid: Story = {
  args: { payments: [{ id: "p1", tender: "cash", amount: 69000, change: 0 }], balanceDue: -1900 },
};
