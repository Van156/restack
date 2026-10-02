import type { Meta, StoryObj } from "@storybook/react-vite";

import SocialSignInButtons from "./social-sign-in-buttons";

const meta = {
  title: "App/Auth/SocialSignInButtons",
  component: SocialSignInButtons,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { providers: ["google"], onSelect: () => {}, pendingProvider: null },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SocialSignInButtons>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Pending: Story = {
  args: { pendingProvider: "google" },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const NoProviders: Story = {
  args: { providers: [] },
};
