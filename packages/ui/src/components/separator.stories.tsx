import type { Meta, StoryObj } from "@storybook/react-vite";

import { Separator } from "@base-template/ui/components/separator";

const meta = {
  title: "UI/Data display/Separator",
  component: Separator,
  tags: ["autodocs"],
  argTypes: { orientation: { control: "select", options: ["horizontal", "vertical"] } },
  render: (args) => (
    <div className="w-64">
      <div className="text-sm font-medium">Base Template</div>
      <p className="text-sm text-muted-foreground">A starter for modern apps.</p>
      <Separator {...args} className="my-4" />
      <p className="text-sm">Docs, guides and examples.</p>
    </div>
  ),
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <div className="flex h-5 items-center gap-4 text-sm">
      <span>Blog</span>
      <Separator {...args} />
      <span>Docs</span>
      <Separator {...args} />
      <span>Source</span>
    </div>
  ),
};
