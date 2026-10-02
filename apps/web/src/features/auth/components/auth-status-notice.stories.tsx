import { Button } from "@base-template/ui/components/button";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleAlert, CircleCheck, MailCheck } from "lucide-react";

import { withRouter } from "@/shared/storybook/with-router";

import AuthStatusNotice from "./auth-status-notice";

const meta = {
  title: "App/Auth/AuthStatusNotice",
  component: AuthStatusNotice,
  tags: ["autodocs"],
  decorators: [
    withRouter,
    (Story) => (
      <div className="w-96 max-w-full">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    icon: <MailCheck />,
    title: "Check your inbox",
    description: "If an account exists for that email, we sent a reset link.",
  },
} satisfies Meta<typeof AuthStatusNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LinkSent: Story = {
  args: {
    children: (
      <Button size="lg" className="w-full">
        Back to sign in
      </Button>
    ),
  },
};

export const InvalidLink: Story = {
  args: {
    icon: <CircleAlert />,
    title: "Invalid or expired link",
    description: "This password reset link is invalid, expired or already used. Request a new one.",
    children: (
      <Button size="lg" className="w-full">
        Request a new link
      </Button>
    ),
  },
};

export const PasswordUpdated: Story = {
  args: {
    icon: <CircleCheck />,
    title: "Password updated",
    description: "Your password was changed and all sessions were signed out. Sign in to continue.",
    children: (
      <Button size="lg" className="w-full">
        Go to sign in
      </Button>
    ),
  },
};
