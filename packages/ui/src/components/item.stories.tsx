import type { Meta, StoryObj } from "@storybook/react-vite";
import { BellIcon, ChevronRightIcon, ShieldCheckIcon } from "lucide-react";

import { Button } from "@base-template/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@base-template/ui/components/item";

const meta = {
  title: "UI/Data display/Item",
  component: Item,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["default", "outline", "muted"] },
    size: { control: "select", options: ["default", "sm", "xs"] },
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <Item {...args}>
      <ItemMedia variant="icon">
        <ShieldCheckIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Two-factor authentication</ItemTitle>
        <ItemDescription>Protect your account with a second step.</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="sm" variant="outline">
          Enable
        </Button>
      </ItemActions>
    </Item>
  ),
} satisfies Meta<typeof Item>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Outline: Story = { args: { variant: "outline" } };

export const Muted: Story = { args: { variant: "muted" } };

export const Small: Story = { args: { size: "sm", variant: "outline" } };

export const ExtraSmall: Story = { args: { size: "xs", variant: "outline" } };

/** `ItemGroup` is `role="list"`, so each direct `Item` is marked `role="listitem"`. */
export const Group: Story = {
  render: () => (
    <ItemGroup>
      <Item role="listitem">
        <ItemMedia variant="icon">
          <BellIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Notifications</ItemTitle>
          <ItemDescription>Choose what you hear about.</ItemDescription>
        </ItemContent>
        <ChevronRightIcon className="size-4" aria-hidden="true" />
      </Item>
      <ItemSeparator />
      <Item role="listitem">
        <ItemMedia variant="icon">
          <ShieldCheckIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Security</ItemTitle>
          <ItemDescription>Passwords and sessions.</ItemDescription>
        </ItemContent>
        <ChevronRightIcon className="size-4" aria-hidden="true" />
      </Item>
    </ItemGroup>
  ),
};
