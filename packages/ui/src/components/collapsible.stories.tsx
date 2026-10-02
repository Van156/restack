import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChevronsUpDownIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@base-template/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@base-template/ui/components/collapsible";

const repos = ["base-template/ui", "base-template/web", "base-template/server"];

const meta = {
  title: "UI/Layout/Collapsible",
  component: Collapsible,
  tags: ["autodocs"],
  render: (args) => (
    <Collapsible {...args} className="flex w-72 flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <h4 className="text-sm font-medium">3 repositories</h4>
        <CollapsibleTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <ChevronsUpDownIcon />
          <span className="sr-only">Toggle repositories</span>
        </CollapsibleTrigger>
      </div>
      <div className="border px-3 py-2 text-sm">{repos[0]}</div>
      <CollapsibleContent className="flex flex-col gap-2">
        {repos.slice(1).map((repo) => (
          <div key={repo} className="border px-3 py-2 text-sm">
            {repo}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  ),
} satisfies Meta<typeof Collapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DefaultOpen: Story = { args: { defaultOpen: true } };

export const Disabled: Story = { args: { disabled: true } };

/** Controlled `open` story. */
export const Open: Story = {
  render: (args) => {
    const [open, setOpen] = useState(true);
    return (
      <Collapsible
        {...args}
        open={open}
        onOpenChange={setOpen}
        className="flex w-72 flex-col gap-2"
      >
        <CollapsibleTrigger render={<Button variant="outline" />}>
          {open ? "Hide details" : "Show details"}
        </CollapsibleTrigger>
        <CollapsibleContent className="border px-3 py-2 text-sm">
          Extra details are revealed here.
        </CollapsibleContent>
      </Collapsible>
    );
  },
};
