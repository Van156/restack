import type { Meta, StoryObj } from "@storybook/react-vite";

import IncidentsView from "./incidents-view";

const meta = {
  title: "App/Dian/IncidentsView",
  component: IncidentsView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    rows: [
      {
        id: "i1",
        causeLabel: "El proveedor no estaba disponible",
        startedAt: new Date("2026-10-03T10:00:00.000Z"),
        endedAt: new Date("2026-10-03T12:00:00.000Z"),
        open: false,
        durationText: "2 h",
        documentsCovered: 4,
      },
      {
        id: "i2",
        causeLabel: "Ventas registradas sin conexión",
        startedAt: new Date("2026-10-03T14:00:00.000Z"),
        endedAt: null,
        open: true,
        durationText: "1 h",
        documentsCovered: 0,
      },
    ],
  },
} satisfies Meta<typeof IncidentsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
