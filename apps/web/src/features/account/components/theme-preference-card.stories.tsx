import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import ThemePreferenceCard from "./theme-preference-card";
import type { ThemePreference } from "../lib/theme-options";

const meta = {
  title: "App/Account/ThemePreferenceCard",
  component: ThemePreferenceCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[28rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: { value: "system", onChange: () => {} },
  render: (args) => {
    const [value, setValue] = useState<ThemePreference>(args.value);
    return <ThemePreferenceCard value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof ThemePreferenceCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const System: Story = {};

export const Dark: Story = { args: { value: "dark" } };
