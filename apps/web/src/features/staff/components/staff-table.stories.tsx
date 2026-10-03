import type { Meta, StoryObj } from "@storybook/react-vite";

import StaffTable from "./staff-table";

const meta = {
  title: "App/Staff/StaffTable",
  component: StaffTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    callerIsOwner: false,
    onEditLocations: () => {},
    onResetPin: () => {},
    rows: [
      {
        memberId: "m1",
        name: "Ana Gómez",
        email: "ana@example.com",
        role: "owner",
        isOwner: true,
        locationIds: [],
        locationNames: [],
      },
      {
        memberId: "m2",
        name: "Carlos Ruiz",
        email: "carlos@example.com",
        role: "waiter",
        isOwner: false,
        locationIds: ["l1", "l2"],
        locationNames: ["Centro", "Norte"],
      },
      {
        memberId: "m3",
        name: "Laura Peña",
        email: "laura@example.com",
        role: "cashier",
        isOwner: false,
        locationIds: [],
        locationNames: [],
      },
    ],
  },
} satisfies Meta<typeof StaffTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An Administrator: the Owner's row has no actions. */
export const AsAdministrator: Story = {};

/** The Owner may also reset the Owner's PIN. */
export const AsOwner: Story = { args: { callerIsOwner: true } };
