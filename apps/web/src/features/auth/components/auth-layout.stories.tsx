import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import AuthCard from "./auth-card";
import AuthLayout from "./auth-layout";
import AuthSwitchPrompt from "./auth-switch-prompt";
import SocialSignInButtons from "./social-sign-in-buttons";

/** Static stand-in for the sign-in form so the screen reads like the real one. */
function SignInPlaceholder() {
  return (
    <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
      <div className="grid gap-2">
        <label htmlFor="story-email" className="text-sm font-medium">
          Email
        </label>
        <Input id="story-email" type="email" placeholder="m@example.com" />
      </div>
      <div className="grid gap-2">
        <label htmlFor="story-password" className="text-sm font-medium">
          Password
        </label>
        <Input id="story-password" type="password" placeholder="********" />
      </div>
      <Button type="submit" size="lg" className="w-full">
        Sign in
      </Button>
      <SocialSignInButtons providers={["google"]} onSelect={() => {}} />
      <AuthSwitchPrompt prompt="Don't have an account?" to="/sign-up" label="Sign up" />
    </form>
  );
}

const meta = {
  title: "App/Auth/AuthLayout",
  component: AuthLayout,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 640 } },
  },
  args: {
    children: (
      <AuthCard title="Welcome back" description="Sign in to your account">
        <SignInPlaceholder />
      </AuthCard>
    ),
  },
} satisfies Meta<typeof AuthLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Light: Story = {
  globals: { theme: "light" },
};

export const Dark: Story = {
  globals: { theme: "dark" },
};

/** Ink strip with the logo above the form, 16px gutters. */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
