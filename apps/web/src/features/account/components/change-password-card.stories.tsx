import type { Meta, StoryObj } from "@storybook/react-vite";

import ChangePasswordCard from "./change-password-card";

const meta = {
  title: "App/Account/ChangePasswordCard",
  component: ChangePasswordCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[32rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: { onSubmit: async () => {} },
} satisfies Meta<typeof ChangePasswordCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WrongCurrentPassword: Story = {
  args: {
    onSubmit: async () => {
      throw new Error("Your current password is incorrect.");
    },
  },
};
