import type { Meta, StoryObj } from "@storybook/react-vite";

import { Label } from "@base-template/ui/components/label";
import { Switch } from "@base-template/ui/components/switch";

const meta = {
  title: "UI/Forms/Switch",
  component: Switch,
  tags: ["autodocs"],
  args: { id: "switch-airplane" },
  argTypes: {
    size: { control: "select", options: ["default", "sm"] },
    checked: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  render: (args) => (
    <Label htmlFor={args.id}>
      <Switch {...args} />
      Airplane mode
    </Label>
  ),
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = { args: { defaultChecked: true } };

export const Small: Story = { args: { size: "sm" } };

export const Disabled: Story = { args: { disabled: true } };

export const DisabledChecked: Story = { args: { disabled: true, defaultChecked: true } };

export const Invalid: Story = { args: { "aria-invalid": true } };
