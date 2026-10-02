import type { Meta, StoryObj } from "@storybook/react-vite";
import { TrashIcon } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@base-template/ui/components/alert-dialog";
import { Button } from "@base-template/ui/components/button";

function DeleteContent({ size }: { size?: "default" | "sm" }) {
  return (
    <AlertDialogContent size={size}>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this project?</AlertDialogTitle>
        <AlertDialogDescription>
          This action cannot be undone. The project and all of its data will be removed.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}

const meta = {
  title: "UI/Overlays/AlertDialog",
  component: AlertDialog,
  tags: ["autodocs"],
  render: (args) => (
    <AlertDialog {...args}>
      <AlertDialogTrigger render={<Button variant="outline" />}>Delete project</AlertDialogTrigger>
      <DeleteContent />
    </AlertDialog>
  ),
} satisfies Meta<typeof AlertDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = {
  render: (args) => (
    <AlertDialog {...args}>
      <AlertDialogTrigger render={<Button variant="outline" />}>Delete project</AlertDialogTrigger>
      <DeleteContent size="sm" />
    </AlertDialog>
  ),
};

export const WithMedia: Story = {
  // a11y: light-theme `color-contrast` is accepted for this story. Design tokens (globals.css,
  // base-lyra + neutral) are out of scope per the frontend-foundation spec; light-theme destructive text is ~4.1-4.3:1 (needs 4.5:1).
  // Dark theme has no violations. Revisit with a theme task.
  parameters: { a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } } },
  render: (args) => (
    <AlertDialog {...args}>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        Delete project
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <TrashIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete this project?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The project and all of its data will be removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

/** Controlled `open` story: the dialog is rendered open for docs and visual review. */
export const Open: Story = {
  // a11y: light-theme `color-contrast` is accepted for this story. Design tokens (globals.css,
  // base-lyra + neutral) are out of scope per the frontend-foundation spec; light-theme destructive text is ~4.1-4.3:1 (needs 4.5:1).
  // Dark theme has no violations. Revisit with a theme task.
  parameters: { a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } } },
  render: (args) => {
    const [open, setOpen] = useState(true);
    return (
      <AlertDialog {...args} open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger render={<Button variant="outline" />}>
          Delete project
        </AlertDialogTrigger>
        <DeleteContent />
      </AlertDialog>
    );
  },
};
