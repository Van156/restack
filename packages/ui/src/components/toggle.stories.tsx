import type { Meta, StoryObj } from "@storybook/react-vite";
import { BoldIcon } from "lucide-react";

import { Toggle } from "@base-template/ui/components/toggle";

const meta = {
  title: "UI/Actions/Toggle",
  component: Toggle,
  tags: ["autodocs"],
  args: { "aria-label": "Toggle bold", children: <BoldIcon /> },
  argTypes: {
    variant: { control: "select", options: ["default", "outline"] },
    size: { control: "select", options: ["default", "sm", "lg"] },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Outline: Story = { args: { variant: "outline" } };

export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };

export const Pressed: Story = { args: { defaultPressed: true } };

export const WithText: Story = {
  args: {
    "aria-label": undefined,
    children: (
      <>
        <BoldIcon data-icon="inline-start" />
        Bold
      </>
    ),
  },
};

export const Disabled: Story = { args: { disabled: true } };

export const Invalid: Story = { args: { "aria-invalid": true } };
