import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRightIcon } from "lucide-react";

import { Button } from "@base-template/ui/components/button";

const meta = {
  title: "UI/Actions/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Button" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "outline", "secondary", "ghost", "destructive", "link"],
    },
    size: {
      control: "select",
      options: ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"],
    },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Outline: Story = { args: { variant: "outline" } };
export const Secondary: Story = { args: { variant: "secondary" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Destructive: Story = {
  // a11y: light-theme `color-contrast` is accepted for this story. Design tokens (globals.css,
  // base-lyra + neutral) are out of scope per the frontend-foundation spec; light-theme destructive text is ~4.1-4.3:1 (needs 4.5:1).
  // Dark theme has no violations. Revisit with a theme task.
  parameters: { a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } } },
  args: { variant: "destructive" },
};
export const Link: Story = { args: { variant: "link" } };

export const ExtraSmall: Story = { args: { size: "xs" } };
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };

export const Icon: Story = {
  args: { size: "icon", "aria-label": "Next", children: <ArrowRightIcon /> },
};
export const IconExtraSmall: Story = {
  args: { size: "icon-xs", "aria-label": "Next", children: <ArrowRightIcon /> },
};
export const IconSmall: Story = {
  args: { size: "icon-sm", "aria-label": "Next", children: <ArrowRightIcon /> },
};
export const IconLarge: Story = {
  args: { size: "icon-lg", "aria-label": "Next", children: <ArrowRightIcon /> },
};

export const Disabled: Story = { args: { disabled: true } };

export const WithIcon: Story = {
  render: (args) => (
    <Button {...args}>
      Continue
      <ArrowRightIcon data-icon="inline-end" />
    </Button>
  ),
};

/** Proves Tailwind generates classes that appear only in story files. */
export const StoryOnlyClass: Story = {
  args: { className: "tracking-[0.37em] outline-dashed" },
};
