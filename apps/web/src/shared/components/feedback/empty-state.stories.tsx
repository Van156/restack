import { Button } from "@base-template/ui/components/button";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { InboxIcon } from "lucide-react";

import EmptyState from "./empty-state";

const meta = {
  title: "App/Feedback/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  args: { title: "No results" },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithIconAndAction: Story = {
  args: {
    title: "No invitations",
    description: "Invite teammates to get started.",
    icon: <InboxIcon />,
    action: <Button>Invite</Button>,
  },
};
