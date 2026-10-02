import type { Meta, StoryObj } from "@storybook/react-vite";

import UserDetailTabs from "./user-detail-tabs";

const meta = {
  title: "App/Admin/UserDetailTabs",
  component: UserDetailTabs,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[40rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    tab: "details",
    onTabChange: () => {},
    details: <p className="text-sm">Org limit, ban and impersonation cards.</p>,
    activity: <p className="text-sm">The user's security log table.</p>,
  },
} satisfies Meta<typeof UserDetailTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Details: Story = {};

export const Activity: Story = { args: { tab: "activity" } };
