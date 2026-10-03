import type { Meta, StoryObj } from "@storybook/react-vite";

import ReviewReport from "./review-report";

const meta = {
  title: "App/Setup/ReviewReport",
  component: ReviewReport,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[36rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    review: {
      unroutedMenuItems: [
        { id: "i1", name: "Bandeja paisa" },
        { id: "i2", name: "Limonada" },
      ],
      emptyAreas: [{ id: "a1", name: "Terraza" }],
      idleStations: [],
      warningCount: 3,
      reminders: ["advertencia_propina"],
    },
    onGoToStep: () => {},
  },
} satisfies Meta<typeof ReviewReport>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithWarnings: Story = {};

/** No warnings: the tip signage reminder still shows. */
export const AllClear: Story = {
  args: {
    review: {
      unroutedMenuItems: [],
      emptyAreas: [],
      idleStations: [],
      warningCount: 0,
      reminders: ["advertencia_propina"],
    },
  },
};
