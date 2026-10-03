import type { Meta, StoryObj } from "@storybook/react-vite";

import CloseShiftForm from "./close-shift-form";

const meta = {
  title: "App/Cashier/CloseShiftForm",
  component: CloseShiftForm,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    expected: { cash: 150_000, card: 80_000, qr_transfer: 30_000 },
    busy: false,
    errorMessage: null,
    onClose: () => {},
  },
} satisfies Meta<typeof CloseShiftForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithError: Story = {
  args: { errorMessage: "Cerrar con diferencia necesita la autorización de un Administrador." },
};
