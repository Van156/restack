import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckIcon } from "lucide-react";

import { Badge } from "@base-template/ui/components/badge";

const meta = {
  title: "UI/Data display/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: { children: "Badge" },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "destructive",
        "success",
        "warning",
        "info",
        "outline",
        "ghost",
        "link",
      ],
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Secondary: Story = { args: { variant: "secondary" } };

export const Destructive: Story = { args: { variant: "destructive" } };

export const Success: Story = { args: { variant: "success", children: "Active" } };

export const Warning: Story = { args: { variant: "warning", children: "Pending" } };

export const Info: Story = { args: { variant: "info", children: "Invited" } };

export const Outline: Story = { args: { variant: "outline" } };

export const Ghost: Story = { args: { variant: "ghost" } };

export const Link: Story = { args: { variant: "link" } };

export const WithIcon: Story = {
  render: (args) => (
    <Badge {...args}>
      <CheckIcon />
      Verified
    </Badge>
  ),
};

/** `render` turns the badge into a link, enabling the `[a]:hover` styles. */
export const AsLink: Story = {
  args: { render: <a href="#top" /> },
};
