import type { Meta, StoryObj } from "@storybook/react-vite";

import { AspectRatio } from "@base-template/ui/components/aspect-ratio";

const meta = {
  title: "UI/Layout/AspectRatio",
  component: AspectRatio,
  tags: ["autodocs"],
  args: { ratio: 16 / 9 },
  argTypes: { ratio: { control: "number" } },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <AspectRatio {...args} className="flex items-center justify-center bg-muted text-sm">
      {args.ratio.toFixed(2)}:1
    </AspectRatio>
  ),
} satisfies Meta<typeof AspectRatio>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Square: Story = { args: { ratio: 1 } };

export const Portrait: Story = { args: { ratio: 3 / 4 } };
