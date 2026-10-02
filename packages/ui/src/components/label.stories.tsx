import type { Meta, StoryObj } from "@storybook/react-vite";

import { Checkbox } from "@base-template/ui/components/checkbox";
import { Input } from "@base-template/ui/components/input";
import { Label } from "@base-template/ui/components/label";

const meta = {
  title: "UI/Forms/Label",
  component: Label,
  tags: ["autodocs"],
  args: { children: "Email address", htmlFor: "label-email" },
  render: (args) => (
    <div className="flex w-72 flex-col gap-2">
      <Label {...args} />
      <Input id="label-email" type="email" placeholder="you@example.com" />
    </div>
  ),
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithCheckbox: Story = {
  render: () => (
    <Label>
      <Checkbox defaultChecked />
      Accept terms and conditions
    </Label>
  ),
};

export const DisabledControl: Story = {
  render: (args) => (
    <div className="flex w-72 flex-col gap-2">
      <Label {...args} />
      <Input id="label-email" type="email" disabled defaultValue="locked@example.com" />
    </div>
  ),
};
