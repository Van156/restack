import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import { Label } from "@base-template/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@base-template/ui/components/popover";

function DimensionsContent({ side }: { side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <PopoverContent side={side}>
      <PopoverHeader>
        <PopoverTitle>Dimensions</PopoverTitle>
        <PopoverDescription>Set the dimensions for the layer.</PopoverDescription>
      </PopoverHeader>
      <div className="grid gap-2">
        <Label htmlFor="popover-width">Width</Label>
        <Input id="popover-width" defaultValue="100%" />
      </div>
    </PopoverContent>
  );
}

const meta = {
  title: "UI/Overlays/Popover",
  component: Popover,
  tags: ["autodocs"],
  render: (args) => (
    <Popover {...args}>
      <PopoverTrigger render={<Button variant="outline" />}>Open popover</PopoverTrigger>
      <DimensionsContent />
    </Popover>
  ),
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Top: Story = {
  render: (args) => (
    <Popover {...args}>
      <PopoverTrigger render={<Button variant="outline" />}>Open above</PopoverTrigger>
      <DimensionsContent side="top" />
    </Popover>
  ),
};

export const Right: Story = {
  render: (args) => (
    <Popover {...args}>
      <PopoverTrigger render={<Button variant="outline" />}>Open to the right</PopoverTrigger>
      <DimensionsContent side="right" />
    </Popover>
  ),
};

/** Controlled `open` story: the popover is rendered open for docs and visual review. */
export const Open: Story = {
  render: (args) => {
    const [open, setOpen] = useState(true);
    return (
      <Popover {...args} open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="outline" />}>Open popover</PopoverTrigger>
        <DimensionsContent />
      </Popover>
    );
  },
};
