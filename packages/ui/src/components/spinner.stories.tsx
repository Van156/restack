import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "@base-template/ui/components/button";
import { Spinner } from "@base-template/ui/components/spinner";

const meta = {
  title: "UI/Feedback/Spinner",
  component: Spinner,
  tags: ["autodocs"],
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner className="size-4" />
      <Spinner className="size-6" />
      <Spinner className="size-10" />
    </div>
  ),
};

export const InButton: Story = {
  render: () => (
    <Button disabled>
      <Spinner data-icon="inline-start" />
      Saving
    </Button>
  ),
};
