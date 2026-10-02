import type { Meta, StoryObj } from "@storybook/react-vite";

import { Input } from "@base-template/ui/components/input";

const meta = {
  title: "UI/Forms/Input",
  component: Input,
  tags: ["autodocs"],
  args: { "aria-label": "Email", placeholder: "you@example.com", type: "email" },
  argTypes: {
    type: { control: "select", options: ["text", "email", "password", "number", "file"] },
    size: { control: "select", options: ["default", "lg"] },
    disabled: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = { args: { defaultValue: "jane@example.com" } };

export const Password: Story = {
  args: { "aria-label": "Password", type: "password", placeholder: "Password" },
};

export const File: Story = { args: { "aria-label": "Attachment", type: "file" } };

export const Disabled: Story = { args: { disabled: true, defaultValue: "locked@example.com" } };

export const Invalid: Story = { args: { "aria-invalid": true, defaultValue: "not-an-email" } };

export const Large: Story = { args: { size: "lg" } };
