import type { Meta, StoryObj } from "@storybook/react-vite";
import { PlusIcon } from "lucide-react";

import { Button } from "@base-template/ui/components/button";
import { Kbd } from "@base-template/ui/components/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@base-template/ui/components/tooltip";

// `TooltipProvider` is applied globally by `.storybook/preview.tsx`.
const meta = {
  title: "UI/Overlays/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  render: (args) => (
    <Tooltip {...args}>
      <TooltipTrigger render={<Button variant="outline" />}>Hover me</TooltipTrigger>
      <TooltipContent>Add to library</TooltipContent>
    </Tooltip>
  ),
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const IconButton: Story = {
  render: (args) => (
    <Tooltip {...args}>
      <TooltipTrigger render={<Button variant="outline" size="icon" aria-label="Add item" />}>
        <PlusIcon />
      </TooltipTrigger>
      <TooltipContent>Add item</TooltipContent>
    </Tooltip>
  ),
};

export const Bottom: Story = {
  render: (args) => (
    <Tooltip {...args}>
      <TooltipTrigger render={<Button variant="outline" />}>Below</TooltipTrigger>
      <TooltipContent side="bottom">Shown below</TooltipContent>
    </Tooltip>
  ),
};

export const WithKeyboardShortcut: Story = {
  render: (args) => (
    <Tooltip {...args}>
      <TooltipTrigger render={<Button variant="outline" />}>Save</TooltipTrigger>
      <TooltipContent>
        Save changes <Kbd>S</Kbd>
      </TooltipContent>
    </Tooltip>
  ),
};

/** Controlled `open` story: the tooltip is rendered open for docs and visual review. */
export const Open: Story = {
  render: (args) => (
    <Tooltip {...args} open>
      <TooltipTrigger render={<Button variant="outline" />}>Hover me</TooltipTrigger>
      <TooltipContent>Add to library</TooltipContent>
    </Tooltip>
  ),
};
