import type { Meta, StoryObj } from "@storybook/react-vite";

import { openBill, paidBill } from "../lib/checkout-fixtures";
import CheckoutView from "./checkout-view";

const meta = {
  title: "App/Cashier/CheckoutView",
  component: CheckoutView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    tableName: "3",
    bill: openBill,
    online: true,
    busy: false,
    errorMessage: null,
    settleQueued: false,
    paymentsBlockedReason: null,
    onBack: () => {},
    onSetTip: () => {},
    onRemoveTip: () => {},
    onPay: () => {},
    onSettle: () => {},
  },
} satisfies Meta<typeof CheckoutView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Charging: Story = {};

export const ReadyToClose: Story = { args: { bill: { ...openBill, balanceDue: 0 } } };

export const Settled: Story = { args: { bill: paidBill } };

export const Offline: Story = { args: { online: false } };

export const WithError: Story = {
  args: { errorMessage: "El pago supera el saldo pendiente." },
};

export const Blocked: Story = {
  args: {
    online: false,
    paymentsBlockedReason:
      "Llevas más de 48 horas sin conexión: las ventas de contingencia están bloqueadas.",
  },
};

export const ChargedOffline: Story = {
  args: {
    online: false,
    settleQueued: true,
    bill: {
      ...openBill,
      balanceDue: 0,
      payments: [
        {
          ...openBill.payments[0]!,
          id: "q1",
          amount: 68_200,
          tendered: 70_000,
          change: 1_800,
          registeredOffline: true,
          queued: true,
        },
      ],
    },
  },
};
