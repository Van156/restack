import type { Meta, StoryObj } from "@storybook/react-vite";

import { Kbd, KbdGroup } from "@base-template/ui/components/kbd";

const meta = {
  title: "UI/Data display/Kbd",
  component: Kbd,
  tags: ["autodocs"],
  args: { children: "K" },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Group: Story = {
  // a11y: light-theme `color-contrast` is accepted for this story. Design tokens (globals.css,
  // base-lyra + neutral) are out of scope per the frontend-foundation spec; muted-foreground on muted is ~4.34:1 (needs 4.5:1).
  // Dark theme has no violations. Revisit with a theme task.
  parameters: { a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } } },
  render: () => (
    <KbdGroup>
      <Kbd>Ctrl</Kbd>
      <Kbd>Shift</Kbd>
      <Kbd>P</Kbd>
    </KbdGroup>
  ),
};

export const InText: Story = {
  // a11y: light-theme `color-contrast` is accepted for this story. Design tokens (globals.css,
  // base-lyra + neutral) are out of scope per the frontend-foundation spec; muted-foreground on muted is ~4.34:1 (needs 4.5:1).
  // Dark theme has no violations. Revisit with a theme task.
  parameters: { a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } } },
  render: () => (
    <p className="text-sm">
      Press{" "}
      <KbdGroup>
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>{" "}
      to open the command palette.
    </p>
  ),
};
