import type { Meta, StoryObj } from "@storybook/react-vite";

import ChangeEmailCard from "./change-email-card";

const meta = {
  title: "App/Account/ChangeEmailCard",
  component: ChangeEmailCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[32rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: { currentEmail: "ada@example.com", onSubmit: async () => {} },
} satisfies Meta<typeof ChangeEmailCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RequestFails: Story = {
  args: {
    onSubmit: async () => {
      throw new Error("Too many requests. Try again later.");
    },
  },
};
