import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "@base-template/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@base-template/ui/components/drawer";

type Direction = "up" | "down" | "left" | "right";

function GoalContent() {
  return (
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Move goal</DrawerTitle>
        <DrawerDescription>Set your daily activity goal.</DrawerDescription>
      </DrawerHeader>
      <div className="px-4 py-2 text-center text-2xl font-semibold">350 kcal / day</div>
      <DrawerFooter>
        <Button>Submit</Button>
        <DrawerClose render={<Button variant="outline" />}>Cancel</DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  );
}

const meta = {
  title: "UI/Overlays/Drawer",
  component: Drawer,
  tags: ["autodocs"],
  argTypes: {
    swipeDirection: { control: "select", options: ["down", "up", "left", "right"] },
    showSwipeHandle: { control: "boolean" },
    modal: { control: "boolean" },
  },
  render: (args) => (
    <Drawer {...args}>
      <DrawerTrigger render={<Button variant="outline" />}>Open drawer</DrawerTrigger>
      <GoalContent />
    </Drawer>
  ),
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

function directionStory(swipeDirection: Direction): Story {
  return {
    args: { swipeDirection },
    render: (args) => (
      <Drawer {...args}>
        <DrawerTrigger render={<Button variant="outline" />}>
          Open {swipeDirection} drawer
        </DrawerTrigger>
        <GoalContent />
      </Drawer>
    ),
  };
}

export const Default: Story = {};

export const WithSwipeHandle: Story = { args: { showSwipeHandle: true } };

export const Down: Story = directionStory("down");
export const Up: Story = directionStory("up");
export const Left: Story = directionStory("left");
export const Right: Story = directionStory("right");

/** Controlled `open` story: the drawer is rendered open for docs and visual review. */
export const Open: Story = {
  render: (args) => {
    const [open, setOpen] = useState(true);
    return (
      <Drawer {...args} open={open} onOpenChange={setOpen}>
        <DrawerTrigger render={<Button variant="outline" />}>Open drawer</DrawerTrigger>
        <GoalContent />
      </Drawer>
    );
  },
};
