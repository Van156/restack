import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "@base-template/ui/components/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@base-template/ui/components/hover-card";

function ProfileCard({ side }: { side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <HoverCardContent side={side}>
      <div className="space-y-1">
        <h4 className="text-sm font-medium">@ada</h4>
        <p>Mathematician and writer, known for her work on the Analytical Engine.</p>
        <p className="text-muted-foreground">Joined December 1815</p>
      </div>
    </HoverCardContent>
  );
}

const meta = {
  title: "UI/Overlays/HoverCard",
  component: HoverCard,
  tags: ["autodocs"],
  render: (args) => (
    <HoverCard {...args}>
      <HoverCardTrigger render={<Button variant="link" />}>@ada</HoverCardTrigger>
      <ProfileCard />
    </HoverCard>
  ),
} satisfies Meta<typeof HoverCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Top: Story = {
  render: (args) => (
    <HoverCard {...args}>
      <HoverCardTrigger render={<Button variant="link" />}>@ada</HoverCardTrigger>
      <ProfileCard side="top" />
    </HoverCard>
  ),
};

/** Controlled `open` story: the card is rendered open for docs and visual review. */
export const Open: Story = {
  render: (args) => (
    <HoverCard {...args} open>
      <HoverCardTrigger render={<Button variant="link" />}>@ada</HoverCardTrigger>
      <ProfileCard />
    </HoverCard>
  ),
};
