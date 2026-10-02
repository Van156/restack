import type { Meta, StoryObj } from "@storybook/react-vite";

import SetPasswordCard from "./set-password-card";

const meta = {
  title: "App/Account/SetPasswordCard",
  component: SetPasswordCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[32rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: { email: "ada@example.com", onRequest: async () => {} },
} satisfies Meta<typeof SetPasswordCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RequestFails: Story = {
  args: {
    onRequest: async () => {
      throw new Error("Could not send the link.");
    },
  },
};
