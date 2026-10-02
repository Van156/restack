import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "@base-template/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@base-template/ui/components/dialog";
import { Input } from "@base-template/ui/components/input";
import { Label } from "@base-template/ui/components/label";

function ProfileDialogBody({ showCloseButton = true }: { showCloseButton?: boolean }) {
  return (
    <DialogContent showCloseButton={showCloseButton}>
      <DialogHeader>
        <DialogTitle>Edit profile</DialogTitle>
        <DialogDescription>
          Make changes to your profile here. Save when you are done.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="dialog-name">Name</Label>
        <Input id="dialog-name" defaultValue="Ada Lovelace" />
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button>Save changes</Button>
      </DialogFooter>
    </DialogContent>
  );
}

const meta = {
  title: "UI/Overlays/Dialog",
  component: Dialog,
  tags: ["autodocs"],
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger render={<Button variant="outline" />}>Edit profile</DialogTrigger>
      <ProfileDialogBody />
    </Dialog>
  ),
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutCloseButton: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger render={<Button variant="outline" />}>Edit profile</DialogTrigger>
      <ProfileDialogBody showCloseButton={false} />
    </Dialog>
  ),
};

export const FooterCloseButton: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger render={<Button variant="outline" />}>Show terms</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Terms of service</DialogTitle>
          <DialogDescription>Please review the terms before continuing.</DialogDescription>
        </DialogHeader>
        <p>By continuing you agree to the terms of service and the privacy policy.</p>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  ),
};

/** Controlled `open` story: the dialog is rendered open for docs and visual review. */
export const Open: Story = {
  render: (args) => {
    const [open, setOpen] = useState(true);
    return (
      <Dialog {...args} open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" />}>Edit profile</DialogTrigger>
        <ProfileDialogBody />
      </Dialog>
    );
  },
};
