import type { Meta, StoryObj } from "@storybook/react-vite";

import { FloorPlanTile } from "@base-template/ui/components/floor-plan-tile";

const meta = {
  title: "UI/Restaurant/Floor plan tile",
  component: FloorPlanTile,
  tags: ["autodocs"],
  args: { name: "Mesa 4", seats: 4, state: "free" },
  argTypes: { state: { control: "select", options: ["free", "occupied", "bill_requested"] } },
} satisfies Meta<typeof FloorPlanTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Free: Story = {};

export const Occupied: Story = { args: { state: "occupied" } };

export const BillRequested: Story = { args: { state: "bill_requested" } };

export const ReadyMarker: Story = { args: { state: "occupied", hasReadyTicket: true } };

export const WaiterCall: Story = { args: { state: "occupied", waiterCallAgeMs: 95_000 } };

export const Floor: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-3">
      <FloorPlanTile name="Mesa 1" seats={2} state="free" />
      <FloorPlanTile name="Mesa 2" seats={4} state="occupied" hasReadyTicket />
      <FloorPlanTile name="Mesa 3" seats={6} state="bill_requested" />
      <FloorPlanTile name="Terraza 1" seats={1} state="occupied" waiterCallAgeMs={40_000} />
    </div>
  ),
};
