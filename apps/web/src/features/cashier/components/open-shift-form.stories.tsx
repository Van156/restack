import type { Meta, StoryObj } from "@storybook/react-vite";

import OpenShiftForm from "./open-shift-form";

const meta = {
  title: "App/Cashier/OpenShiftForm",
  component: OpenShiftForm,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { busy: false, errorMessage: null, onOpen: () => {} },
} satisfies Meta<typeof OpenShiftForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AlreadyOpen: Story = {
  args: { errorMessage: "Este local ya tiene un turno de caja abierto." },
};
