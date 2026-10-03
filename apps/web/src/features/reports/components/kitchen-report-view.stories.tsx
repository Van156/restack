import type { Meta, StoryObj } from "@storybook/react-vite";

import KitchenReportView from "./kitchen-report-view";

const meta = {
  title: "App/Reports/KitchenReportView",
  component: KitchenReportView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    view: {
      total: {
        ticketCount: 40,
        completedCount: 36,
        sentToReady: { average: "12 min", worst: "25 min" },
        preparation: { average: "9 min", worst: "20 min" },
        pickup: { average: "2 min", worst: "—" },
      },
      locations: [
        {
          locationId: "a",
          name: "Centro",
          ticketCount: 40,
          completedCount: 36,
          sentToReady: { average: "12 min", worst: "25 min" },
          preparation: { average: "9 min", worst: "20 min" },
          pickup: { average: "2 min", worst: "—" },
        },
      ],
      isEmpty: false,
    },
  },
} satisfies Meta<typeof KitchenReportView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
