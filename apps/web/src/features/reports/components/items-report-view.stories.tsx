import type { Meta, StoryObj } from "@storybook/react-vite";

import ItemsReportView from "./items-report-view";

const meta = {
  title: "App/Reports/ItemsReportView",
  component: ItemsReportView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    rows: [
      {
        key: "m1",
        name: "Bandeja paisa",
        quantity: 14,
        revenue: 490_000,
        cost: 196_000,
        margin: 294_000,
        marginPercent: 60,
        costMissing: false,
      },
      {
        key: "m2",
        name: "Jugo de mora",
        quantity: 22,
        revenue: 110_000,
        cost: null,
        margin: null,
        marginPercent: null,
        costMissing: true,
      },
    ],
    totals: {
      revenue: 600_000,
      cost: 196_000,
      margin: 294_000,
      marginPercent: 60,
      marginIncomplete: true,
    },
  },
} satisfies Meta<typeof ItemsReportView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
