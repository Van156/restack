import type { Meta, StoryObj } from "@storybook/react-vite";

import SetupStepper from "./setup-stepper";

const meta = {
  title: "App/Setup/SetupStepper",
  component: SetupStepper,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    current: "tables",
    completion: { areas: true, tables: false, stations: false, menu: false, review: false },
    onSelect: () => {},
  },
} satisfies Meta<typeof SetupStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Second step in progress, the first one done. */
export const InProgress: Story = {};

/** Every step complete. */
export const AllDone: Story = {
  args: {
    current: "review",
    completion: { areas: true, tables: true, stations: true, menu: true, review: true },
  },
};
