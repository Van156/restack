import type { Meta, StoryObj } from "@storybook/react-vite";

import { openBill, paidBill } from "./checkout-fixtures";
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
