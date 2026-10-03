import type { Meta, StoryObj } from "@storybook/react-vite";

import PaymentForm from "./payment-form";

const meta = {
  title: "App/Cashier/PaymentForm",
  component: PaymentForm,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { balanceDue: 48_200, busy: false, blockedReason: null, onSubmit: () => {} },
} satisfies Meta<typeof PaymentForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Cash: Story = {};

export const Busy: Story = { args: { busy: true } };

export const Blocked: Story = {
  args: {
    blockedReason:
      "Llevas más de 48 horas sin conexión: las ventas de contingencia están bloqueadas.",
  },
};
