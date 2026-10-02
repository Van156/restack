import type { Meta, StoryObj } from "@storybook/react-vite";

import { Slider } from "@base-template/ui/components/slider";

const meta = {
  title: "UI/Forms/Slider",
  component: Slider,
  tags: ["autodocs"],
  args: { "aria-label": "Volume", defaultValue: 40 },
  argTypes: {
    orientation: { control: "select", options: ["horizontal", "vertical"] },
    min: { control: "number" },
    max: { control: "number" },
    step: { control: "number" },
    disabled: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Single: Story = { args: { defaultValue: 65 } };

export const Range: Story = {
  args: { "aria-label": "Price range", defaultValue: [25, 75] },
};

export const Stepped: Story = { args: { defaultValue: 50, step: 10 } };

export const Vertical: Story = {
  args: { orientation: "vertical", defaultValue: 40 },
  decorators: [
    (Story) => (
      <div className="h-48">
        <Story />
      </div>
    ),
  ],
};

export const Disabled: Story = { args: { disabled: true } };

export const Invalid: Story = { args: { "aria-invalid": true } };

/**
 * An empty array puts Base UI in range mode with no values, so no thumbs are rendered.
 * Pass a scalar or a non-empty array to get thumbs.
 */
export const EmptyRange: Story = { args: { "aria-label": "No thumbs", defaultValue: [] } };
