import type { Meta, StoryObj } from "@storybook/react-vite";

import { Skeleton } from "@base-template/ui/components/skeleton";

const meta = {
  title: "UI/Feedback/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  args: { className: "h-4 w-64" },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Circle: Story = { args: { className: "size-12 rounded-full" } };

/** Loading placeholder for a media row; static sizes, no random widths. */
export const CardPlaceholder: Story = {
  render: () => (
    <div className="flex items-center gap-4" role="status" aria-label="Loading profile">
      <Skeleton className="size-12 rounded-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
    </div>
  ),
};
