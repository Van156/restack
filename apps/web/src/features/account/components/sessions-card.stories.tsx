import type { Meta, StoryObj } from "@storybook/react-vite";

import SessionsCard from "./sessions-card";

const meta = {
  title: "App/Account/SessionsCard",
  component: SessionsCard,
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
    sessions: [
      {
        id: "s1",
        token: "t1",
        device: "Chrome on macOS",
        ipAddress: "203.0.113.7",
        lastActive: new Date("2026-10-01T10:00:00Z"),
        isCurrent: true,
      },
      {
        id: "s2",
        token: "t2",
        device: "Safari on iOS",
        ipAddress: "198.51.100.23",
        lastActive: new Date("2026-09-28T18:30:00Z"),
        isCurrent: false,
      },
      {
        id: "s3",
        token: "t3",
        device: "Unknown device",
        ipAddress: null,
        lastActive: new Date("2026-09-12T08:05:00Z"),
        isCurrent: false,
      },
    ],
    onRevoke: () => {},
    onRevokeOthers: () => {},
  },
} satisfies Meta<typeof SessionsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OnlyCurrentSession: Story = {
  args: { sessions: [{ ...meta.args.sessions[0] }] },
};
