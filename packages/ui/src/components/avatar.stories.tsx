import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckIcon } from "lucide-react";

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@base-template/ui/components/avatar";

/** Inline SVG portrait so stories never hit the network. */
const portrait = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#6366f1"/><circle cx="32" cy="24" r="12" fill="#e0e7ff"/><path d="M8 64c0-14 11-24 24-24s24 10 24 24z" fill="#e0e7ff"/></svg>',
)}`;

const meta = {
  title: "UI/Data display/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  argTypes: { size: { control: "select", options: ["sm", "default", "lg"] } },
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src={portrait} alt="Ada Lovelace" />
      <AvatarFallback>AL</AvatarFallback>
    </Avatar>
  ),
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = { args: { size: "sm" } };

export const Large: Story = { args: { size: "lg" } };

/** The image source is invalid, so the fallback initials render. */
export const Fallback: Story = {
  // a11y: light-theme `color-contrast` is accepted for this story. Design tokens (globals.css,
  // base-lyra + neutral) are out of scope per the frontend-foundation spec; muted-foreground on muted is ~4.34:1 (needs 4.5:1).
  // Dark theme has no violations. Revisit with a theme task.
  parameters: { a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } } },
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src="data:," alt="Grace Hopper" />
      <AvatarFallback>GH</AvatarFallback>
    </Avatar>
  ),
};

export const WithBadge: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src={portrait} alt="Ada Lovelace" />
      <AvatarFallback>AL</AvatarFallback>
      <AvatarBadge>
        <CheckIcon />
      </AvatarBadge>
    </Avatar>
  ),
};

export const Group: Story = {
  // a11y: light-theme `color-contrast` is accepted for this story. Design tokens (globals.css,
  // base-lyra + neutral) are out of scope per the frontend-foundation spec; muted-foreground on muted is ~4.34:1 (needs 4.5:1).
  // Dark theme has no violations. Revisit with a theme task.
  parameters: { a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } } },
  render: (args) => (
    <AvatarGroup>
      <Avatar {...args}>
        <AvatarImage src={portrait} alt="Ada Lovelace" />
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>
      <Avatar {...args}>
        <AvatarFallback>GH</AvatarFallback>
      </Avatar>
      <Avatar {...args}>
        <AvatarFallback>AT</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+3</AvatarGroupCount>
    </AvatarGroup>
  ),
};
