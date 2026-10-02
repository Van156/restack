import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarIcon, SettingsIcon, SmileIcon, UserIcon } from "lucide-react";
import { useState } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@base-template/ui/components/command";
import { Button } from "@base-template/ui/components/button";

function CommandBody() {
  return (
    <>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem>
            <CalendarIcon />
            Calendar
          </CommandItem>
          <CommandItem>
            <SmileIcon />
            Search emoji
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem>
            <UserIcon />
            Profile
            <CommandShortcut>P</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <SettingsIcon />
            Settings
            <CommandShortcut>S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </>
  );
}

const meta = {
  title: "UI/Overlays/Command",
  component: Command,
  tags: ["autodocs"],
  render: (args) => (
    <Command {...args} className="h-auto w-80 border">
      <CommandBody />
    </Command>
  ),
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  // a11y: `aria-required-children` is a known false positive here. cmdk hard-codes
  // `role="separator"` on `CommandSeparator` (set after spread props, so it cannot be overridden)
  // and renders it inside the `role="listbox"` list, which axe does not allow. The wrapper cannot
  // fix this without replacing cmdk.
  parameters: { a11y: { config: { rules: [{ id: "aria-required-children", enabled: false }] } } },
};

/** A search with no matches shows the `CommandEmpty` state. */
export const Empty: Story = {
  // a11y: `aria-required-children` is a known false positive here. cmdk hard-codes
  // `role="separator"` on `CommandSeparator` (set after spread props, so it cannot be overridden)
  // and renders it inside the `role="listbox"` list, which axe does not allow. The wrapper cannot
  // fix this without replacing cmdk.
  parameters: { a11y: { config: { rules: [{ id: "aria-required-children", enabled: false }] } } },
  render: (args) => (
    <Command {...args} className="h-auto w-80 border">
      <CommandBody />
    </Command>
  ),
  play: async ({ canvas, expect, userEvent }) => {
    await userEvent.type(canvas.getByPlaceholderText("Type a command or search..."), "zzzz");
    await expect(await canvas.findByText("No results found.")).toBeVisible();
  },
};

export const Dialog: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Open command palette
        </Button>
        <CommandDialog open={open} onOpenChange={setOpen}>
          <Command>
            <CommandBody />
          </Command>
        </CommandDialog>
      </>
    );
  },
};

/** Controlled `open` story: the command palette is rendered open for docs and visual review. */
export const Open: Story = {
  // a11y: `aria-required-children` is a known false positive here. cmdk hard-codes
  // `role="separator"` on `CommandSeparator` (set after spread props, so it cannot be overridden)
  // and renders it inside the `role="listbox"` list, which axe does not allow. The wrapper cannot
  // fix this without replacing cmdk.
  parameters: { a11y: { config: { rules: [{ id: "aria-required-children", enabled: false }] } } },
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandBody />
        </Command>
      </CommandDialog>
    );
  },
};
