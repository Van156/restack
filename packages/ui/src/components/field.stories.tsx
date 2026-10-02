import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Checkbox } from "@base-template/ui/components/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@base-template/ui/components/radio-group";
import { Textarea } from "@base-template/ui/components/textarea";

const meta = {
  title: "UI/Forms/Field",
  component: Field,
  tags: ["autodocs"],
  argTypes: {
    orientation: { control: "select", options: ["vertical", "horizontal", "responsive"] },
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = useState("");
    return (
      <Field {...args}>
        <FieldLabel htmlFor="field-username">Username</FieldLabel>
        <Input
          id="field-username"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="jane"
        />
        <FieldDescription>Choose a unique username for your account.</FieldDescription>
      </Field>
    );
  },
};

export const WithError: Story = {
  render: (args) => {
    const [value, setValue] = useState("ab");
    const error = value.length < 3 ? "Username must be at least 3 characters." : undefined;
    return (
      <Field {...args} data-invalid={Boolean(error)}>
        <FieldLabel htmlFor="field-username-error">Username</FieldLabel>
        <Input
          id="field-username-error"
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "field-username-error-message" : undefined}
          onChange={(event) => setValue(event.target.value)}
        />
        {error ? <FieldError id="field-username-error-message">{error}</FieldError> : null}
      </Field>
    );
  },
};

export const Disabled: Story = {
  render: (args) => (
    <Field {...args} data-disabled="true">
      <FieldLabel htmlFor="field-disabled">Username</FieldLabel>
      <Input id="field-disabled" disabled defaultValue="jane" />
      <FieldDescription>This field cannot be edited.</FieldDescription>
    </Field>
  ),
};

export const Horizontal: Story = {
  args: { orientation: "horizontal" },
  render: (args) => (
    <Field {...args}>
      <Checkbox id="field-newsletter" defaultChecked />
      <FieldContent>
        <FieldLabel htmlFor="field-newsletter">Subscribe to the newsletter</FieldLabel>
        <FieldDescription>Receive product updates once a month.</FieldDescription>
      </FieldContent>
    </Field>
  ),
};

export const MultipleErrors: Story = {
  render: () => (
    <Field data-invalid="true">
      <FieldLabel htmlFor="field-password">Password</FieldLabel>
      <Input id="field-password" type="password" aria-invalid defaultValue="abc" />
      <FieldError
        errors={[
          { message: "Must be at least 8 characters." },
          { message: "Must contain a number." },
        ]}
      />
    </Field>
  ),
};

export const FieldSetComposition: Story = {
  render: () => {
    const [plan, setPlan] = useState("pro");
    return (
      <form onSubmit={(event) => event.preventDefault()}>
        <FieldSet>
          <FieldLegend>Account</FieldLegend>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="field-set-name">Name</FieldLabel>
              <Input id="field-set-name" defaultValue="Jane Doe" />
            </Field>
            <Field>
              <FieldLabel htmlFor="field-set-bio">Bio</FieldLabel>
              <Textarea id="field-set-bio" placeholder="Tell us about yourself" />
              <FieldDescription>Shown on your public profile.</FieldDescription>
            </Field>
            <FieldSeparator>Plan</FieldSeparator>
            <Field>
              <FieldLabel id="field-set-plan-label">Plan</FieldLabel>
              <RadioGroup
                aria-labelledby="field-set-plan-label"
                value={plan}
                onValueChange={setPlan}
              >
                <Field orientation="horizontal">
                  <RadioGroupItem id="field-set-free" value="free" />
                  <FieldLabel htmlFor="field-set-free">Free</FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <RadioGroupItem id="field-set-pro" value="pro" />
                  <FieldLabel htmlFor="field-set-pro">Pro</FieldLabel>
                </Field>
              </RadioGroup>
            </Field>
          </FieldGroup>
        </FieldSet>
      </form>
    );
  },
};
