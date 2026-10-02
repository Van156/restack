import type { Meta, StoryObj } from "@storybook/react-vite";

import { Checkbox } from "@base-template/ui/components/checkbox";
import { Label } from "@base-template/ui/components/label";

const meta = {
  title: "UI/Forms/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  args: { id: "checkbox-terms" },
  argTypes: {
    checked: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  render: (args) => (
    <Label htmlFor={args.id}>
      <Checkbox {...args} />
      Accept terms and conditions
    </Label>
  ),
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = { args: { defaultChecked: true } };

export const Indeterminate: Story = { args: { indeterminate: true } };

export const Disabled: Story = { args: { disabled: true } };

export const DisabledChecked: Story = { args: { disabled: true, defaultChecked: true } };

export const Invalid: Story = { args: { "aria-invalid": true } };
