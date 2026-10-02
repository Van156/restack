import type { Meta, StoryObj } from "@storybook/react-vite";

import AuthFormError from "./auth-form-error";

const meta = {
  title: "App/Auth/AuthFormError",
  component: AuthFormError,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { message: "Invalid email or password" },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AuthFormError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongMessage: Story = {
  args: {
    message: "An account with this email already exists. Sign in instead or reset your password.",
  },
};
