import type { Meta, StoryObj } from "@storybook/react-vite";

import ProfileForm from "./profile-form";

const meta = {
  title: "App/Account/ProfileForm",
  component: ProfileForm,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[32rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    name: "Ada Lovelace",
    email: "ada@example.com",
    onSave: async () => {},
  },
} satisfies Meta<typeof ProfileForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SaveFails: Story = {
  args: {
    onSave: async () => {
      throw new Error("Could not update your name.");
    },
  },
};
