import type { Meta, StoryObj } from "@storybook/react-vite";

import { Textarea } from "@base-template/ui/components/textarea";

const meta = {
  title: "UI/Forms/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  args: { "aria-label": "Message", placeholder: "Type your message here." },
  argTypes: { disabled: { control: "boolean" } },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = {
  args: {
    defaultValue: "Storybook stories are deterministic fixtures.\nThey never call the network.",
  },
};

export const Disabled: Story = { args: { disabled: true, defaultValue: "Read-only content" } };

export const Invalid: Story = { args: { "aria-invalid": true, defaultValue: "Too short" } };
