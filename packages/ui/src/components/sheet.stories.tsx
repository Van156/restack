import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import { Label } from "@base-template/ui/components/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@base-template/ui/components/sheet";

type Side = "top" | "right" | "bottom" | "left";

function SettingsSheet({ side, showCloseButton }: { side?: Side; showCloseButton?: boolean }) {
  return (
    <SheetContent side={side} showCloseButton={showCloseButton}>
      <SheetHeader>
        <SheetTitle>Edit profile</SheetTitle>
        <SheetDescription>
          Make changes to your profile here. Save when you are done.
        </SheetDescription>
      </SheetHeader>
      <div className="grid gap-2 px-4">
        <Label htmlFor="sheet-name">Name</Label>
        <Input id="sheet-name" defaultValue="Ada Lovelace" />
      </div>
      <SheetFooter>
        <Button>Save changes</Button>
        <SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
      </SheetFooter>
    </SheetContent>
  );
}

const meta = {
  title: "UI/Overlays/Sheet",
  component: Sheet,
  tags: ["autodocs"],
  render: (args) => (
    <Sheet {...args}>
      <SheetTrigger render={<Button variant="outline" />}>Open sheet</SheetTrigger>
      <SettingsSheet />
    </Sheet>
  ),
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

function sideStory(side: Side): Story {
  return {
    render: (args) => (
      <Sheet {...args}>
        <SheetTrigger render={<Button variant="outline" />}>Open {side} sheet</SheetTrigger>
        <SettingsSheet side={side} />
      </Sheet>
    ),
  };
}

export const Default: Story = {};

export const Right: Story = sideStory("right");
export const Left: Story = sideStory("left");
export const Top: Story = sideStory("top");
export const Bottom: Story = sideStory("bottom");

export const WithoutCloseButton: Story = {
  render: (args) => (
    <Sheet {...args}>
      <SheetTrigger render={<Button variant="outline" />}>Open sheet</SheetTrigger>
      <SettingsSheet showCloseButton={false} />
    </Sheet>
  ),
};

/** Controlled `open` story: the sheet is rendered open for docs and visual review. */
export const Open: Story = {
  render: (args) => {
    const [open, setOpen] = useState(true);
    return (
      <Sheet {...args} open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="outline" />}>Open sheet</SheetTrigger>
        <SettingsSheet />
      </Sheet>
    );
  },
};
