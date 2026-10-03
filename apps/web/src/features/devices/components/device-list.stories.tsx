import type { Meta, StoryObj } from "@storybook/react-vite";

import DeviceList from "./device-list";

const meta = {
  title: "App/Devices/DeviceList",
  component: DeviceList,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    now: new Date("2026-10-03T17:00:00Z"),
    isBusy: false,
    onRename: async () => {},
    onRevoke: async () => {},
    devices: [
      {
        id: "d1",
        name: "Cocina",
        status: "active",
        lastSeenAt: new Date("2026-10-03T16:59:00Z"),
        activationExpiresAt: null,
        stationNames: ["Cocina caliente", "Cocina fría"],
      },
      {
        id: "d2",
        name: "Barra",
        status: "pending",
        lastSeenAt: null,
        activationExpiresAt: new Date("2026-10-03T17:15:00Z"),
        stationNames: ["Bar"],
      },
      {
        id: "d3",
        name: "Pantalla vieja",
        status: "pending",
        lastSeenAt: null,
        activationExpiresAt: new Date("2026-10-03T16:00:00Z"),
        stationNames: ["Bar"],
      },
      {
        id: "d4",
        name: "Perdida",
        status: "revoked",
        lastSeenAt: new Date("2026-10-01T22:00:00Z"),
        activationExpiresAt: null,
        stationNames: ["Cocina caliente"],
      },
    ],
  },
} satisfies Meta<typeof DeviceList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mixed: Story = {};

export const Empty: Story = { args: { devices: [] } };
