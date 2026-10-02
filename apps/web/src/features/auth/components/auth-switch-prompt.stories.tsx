import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import AuthSwitchPrompt from "./auth-switch-prompt";

const meta = {
  title: "App/Auth/AuthSwitchPrompt",
  component: AuthSwitchPrompt,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "centered" },
  args: {
    prompt: "Don't have an account?",
    to: "/sign-up",
    label: "Sign up",
  },
} satisfies Meta<typeof AuthSwitchPrompt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignUpLink: Story = {};

export const SignInLink: Story = {
  args: { prompt: "Already have an account?", to: "/sign-in", label: "Sign in" },
};

export const PreservingInvitation: Story = {
  args: { search: { invitationId: "inv_123" } },
};
