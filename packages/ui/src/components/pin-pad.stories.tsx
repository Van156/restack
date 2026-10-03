import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { PinPad } from "@base-template/ui/components/pin-pad";

const meta = {
  title: "UI/Restaurant/PIN pad",
  component: PinPad,
  tags: ["autodocs"],
  args: { onSubmit: fn() },
  argTypes: { status: { control: "select", options: ["idle", "error", "locked"] } },
} satisfies Meta<typeof PinPad>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WrongPin: Story = { args: { status: "error" } };

export const Locked: Story = {
  args: { status: "locked", message: "Demasiados intentos. Intenta de nuevo en 5 minutos." },
};
