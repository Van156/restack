import type { Meta, StoryObj } from "@storybook/react-vite";

import SetupPreview from "./setup-preview";

const meta = {
  title: "App/Setup/SetupPreview",
  component: SetupPreview,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    areas: [
      {
        id: "a1",
        name: "Salón",
        tables: [
          { id: "t1", name: "Mesa 1", seats: 4 },
          { id: "t2", name: "Mesa 2", seats: 2 },
        ],
      },
      { id: "a2", name: "Terraza", tables: [] },
    ],
    stationNames: ["Cocina caliente", "Bar"],
    menuItemCount: 24,
  },
} satisfies Meta<typeof SetupPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithRoom: Story = {};

/** Nothing configured yet. */
export const Empty: Story = { args: { areas: [], stationNames: [], menuItemCount: 0 } };
