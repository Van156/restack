import type { Meta, StoryObj } from "@storybook/react-vite";

import FloorPlanView from "./floor-plan-view";

const meta = {
  title: "App/Waiter/FloorPlanView",
  component: FloorPlanView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    areaId: "a1",
    onAreaChange: () => {},
    onSelectTable: () => {},
    areas: [
      {
        id: "a1",
        name: "Salón",
        tables: [
          {
            tableId: "t1",
            name: "1",
            seats: 4,
            state: "free",
            hasReadyTicket: false,
            waiterCallAgeMs: null,
            sessionId: null,
          },
          {
            tableId: "t2",
            name: "2",
            seats: 2,
            state: "occupied",
            hasReadyTicket: true,
            waiterCallAgeMs: null,
            sessionId: "s2",
          },
          {
            tableId: "t3",
            name: "3",
            seats: 6,
            state: "bill_requested",
            hasReadyTicket: false,
            waiterCallAgeMs: 95_000,
            sessionId: "s3",
          },
        ],
      },
      { id: "a2", name: "Terraza", tables: [] },
    ],
  },
} satisfies Meta<typeof FloorPlanView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mixed: Story = {};

export const EmptyArea: Story = { args: { areaId: "a2" } };
