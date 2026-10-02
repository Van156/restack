import type { Meta, StoryObj } from "@storybook/react-vite";

import { Label } from "@base-template/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@base-template/ui/components/radio-group";

const plans = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "team", label: "Team" },
];

const meta = {
  title: "UI/Forms/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
  args: { "aria-label": "Plan", defaultValue: "pro" },
  argTypes: { disabled: { control: "boolean" } },
  render: (args) => (
    <RadioGroup {...args}>
      {plans.map((plan) => (
        <Label key={plan.value} htmlFor={`plan-${plan.value}`}>
          <RadioGroupItem id={`plan-${plan.value}`} value={plan.value} />
          {plan.label}
        </Label>
      ))}
    </RadioGroup>
  ),
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoSelection: Story = { args: { defaultValue: undefined } };

export const Disabled: Story = { args: { disabled: true } };

export const Invalid: Story = {
  render: (args) => (
    <RadioGroup {...args}>
      {plans.map((plan) => (
        <Label key={plan.value} htmlFor={`plan-invalid-${plan.value}`}>
          <RadioGroupItem id={`plan-invalid-${plan.value}`} value={plan.value} aria-invalid />
          {plan.label}
        </Label>
      ))}
    </RadioGroup>
  ),
};
