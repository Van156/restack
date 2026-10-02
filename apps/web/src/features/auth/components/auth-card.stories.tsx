import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import type { Meta, StoryObj } from "@storybook/react-vite";

import AuthCard from "./auth-card";

/** Static stand-in for a real form column. */
function FormPlaceholder() {
  return (
    <>
      <div className="grid gap-3">
        <label htmlFor="story-email" className="text-sm font-medium">
          Email
        </label>
        <Input size="lg" id="story-email" type="email" placeholder="m@example.com" />
      </div>
      <Button size="lg" className="w-full">
        Continue
      </Button>
    </>
  );
}

const meta = {
  title: "App/Auth/AuthCard",
  component: AuthCard,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          'Form column content: optional title and description above the form. Inputs and buttons use `size="lg"` (h-10); the brand panel lives in `AuthLayout`.',
      },
    },
  },
  args: {
    title: "Welcome back",
    description: "Sign in to your account",
    children: <FormPlaceholder />,
  },
  decorators: [
    (Story) => (
      <div className="w-96 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AuthCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Light: Story = {
  globals: { theme: "light" },
};

export const Dark: Story = {
  globals: { theme: "dark" },
};

export const WithoutHeader: Story = {
  args: { title: undefined, description: undefined },
};

export const DescriptionOnly: Story = {
  args: { title: undefined },
};
