import type { Meta, StoryObj } from "@storybook/react-vite";

import { Progress, ProgressLabel, ProgressValue } from "@base-template/ui/components/progress";

const meta = {
  title: "UI/Feedback/Progress",
  component: Progress,
  tags: ["autodocs"],
  args: { value: 60, "aria-label": "Upload progress" },
  argTypes: { value: { control: { type: "range", min: 0, max: 100 } } },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { value: 0 } };

export const Complete: Story = { args: { value: 100 } };

export const WithLabelAndValue: Story = {
  args: { "aria-label": undefined },
  render: (args) => (
    <Progress {...args}>
      <ProgressLabel>Uploading</ProgressLabel>
      <ProgressValue />
    </Progress>
  ),
};

/** `value={null}` renders the indeterminate state. */
export const Indeterminate: Story = { args: { value: null } };
