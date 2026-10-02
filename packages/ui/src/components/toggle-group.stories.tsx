import type { Meta, StoryObj } from "@storybook/react-vite";
import { BoldIcon, ItalicIcon, UnderlineIcon } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@base-template/ui/components/toggle-group";

const meta = {
  title: "UI/Actions/ToggleGroup",
  component: ToggleGroup,
  tags: ["autodocs"],
  args: {
    "aria-label": "Text formatting",
    multiple: true,
    children: (
      <>
        <ToggleGroupItem value="bold" aria-label="Bold">
          <BoldIcon />
        </ToggleGroupItem>
        <ToggleGroupItem value="italic" aria-label="Italic">
          <ItalicIcon />
        </ToggleGroupItem>
        <ToggleGroupItem value="underline" aria-label="Underline">
          <UnderlineIcon />
        </ToggleGroupItem>
      </>
    ),
  },
  argTypes: {
    variant: { control: "select", options: ["default", "outline"] },
    size: { control: "select", options: ["default", "sm", "lg"] },
    orientation: { control: "select", options: ["horizontal", "vertical"] },
    spacing: { control: "number" },
    multiple: { control: "boolean" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof ToggleGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Outline: Story = { args: { variant: "outline", spacing: 0 } };

export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };

export const Vertical: Story = { args: { orientation: "vertical" } };

export const SingleSelection: Story = {
  args: { multiple: false, defaultValue: ["italic"], variant: "outline", spacing: 0 },
};

export const WithDefaultValue: Story = { args: { defaultValue: ["bold", "underline"] } };

export const Disabled: Story = { args: { disabled: true } };
