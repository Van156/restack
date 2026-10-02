import type { Meta, StoryObj } from "@storybook/react-vite";

import { ScrollArea, ScrollBar } from "@base-template/ui/components/scroll-area";
import { Separator } from "@base-template/ui/components/separator";

const tags = Array.from({ length: 30 }, (_, index) => `v1.${30 - index}.0`);

const meta = {
  title: "UI/Data display/ScrollArea",
  component: ScrollArea,
  tags: ["autodocs"],
  render: (args) => (
    <ScrollArea {...args} className="h-56 w-48 border">
      <div className="p-4">
        <h4 className="mb-3 text-sm font-medium">Releases</h4>
        {tags.map((tag) => (
          <div key={tag}>
            <div className="text-sm">{tag}</div>
            <Separator className="my-2" />
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Horizontal: Story = {
  render: (args) => (
    <ScrollArea {...args} className="w-72 border whitespace-nowrap">
      <div className="flex gap-4 p-4">
        {tags.slice(0, 12).map((tag) => (
          <span key={tag} className="text-sm">
            {tag}
          </span>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  ),
};
