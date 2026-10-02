import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@base-template/ui/components/context-menu";

function RightClickArea() {
  return (
    <ContextMenuTrigger className="flex h-40 w-72 items-center justify-center border border-dashed text-xs text-muted-foreground">
      Right click here
    </ContextMenuTrigger>
  );
}

const meta = {
  title: "UI/Overlays/ContextMenu",
  component: ContextMenu,
  tags: ["autodocs"],
  render: (args) => (
    <ContextMenu {...args}>
      <RightClickArea />
      <ContextMenuContent className="w-52">
        <ContextMenuItem>
          Back <ContextMenuShortcut>[</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled>Forward</ContextMenuItem>
        <ContextMenuItem>
          Reload <ContextMenuShortcut>R</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive">Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
} satisfies Meta<typeof ContextMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSubmenu: Story = {
  render: (args) => (
    <ContextMenu {...args}>
      <RightClickArea />
      <ContextMenuContent className="w-52">
        <ContextMenuItem>Open</ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>More tools</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem>Save page as...</ContextMenuItem>
            <ContextMenuItem>Developer tools</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  ),
};

export const WithCheckboxAndRadioItems: Story = {
  render: (args) => {
    const [bookmarks, setBookmarks] = useState(true);
    const [person, setPerson] = useState("ada");
    return (
      <ContextMenu {...args}>
        <RightClickArea />
        <ContextMenuContent className="w-52">
          <ContextMenuGroup>
            <ContextMenuLabel>View</ContextMenuLabel>
            <ContextMenuCheckboxItem checked={bookmarks} onCheckedChange={setBookmarks}>
              Show bookmarks
            </ContextMenuCheckboxItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuLabel>People</ContextMenuLabel>
            <ContextMenuRadioGroup value={person} onValueChange={setPerson}>
              <ContextMenuRadioItem value="ada">Ada</ContextMenuRadioItem>
              <ContextMenuRadioItem value="grace">Grace</ContextMenuRadioItem>
            </ContextMenuRadioGroup>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
    );
  },
};
