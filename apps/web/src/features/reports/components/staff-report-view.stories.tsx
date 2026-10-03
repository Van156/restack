import type { Meta, StoryObj } from "@storybook/react-vite";

import StaffReportView from "./staff-report-view";

const meta = {
  title: "App/Reports/StaffReportView",
  component: StaffReportView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    rows: [
      {
        key: "m1",
        name: "Ana Pérez",
        billCount: 9,
        salesTotal: 700_000,
        tipTotal: 70_000,
        cost: 250_000,
        margin: 380_000,
        marginPercent: 60,
        marginIncomplete: true,
      },
      {
        key: "none",
        name: "Sin asignar",
        billCount: 1,
        salesTotal: 40_000,
        tipTotal: 0,
        cost: 0,
        margin: null,
        marginPercent: null,
        marginIncomplete: true,
      },
    ],
  },
} satisfies Meta<typeof StaffReportView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
