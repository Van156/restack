import type { Meta, StoryObj } from "@storybook/react-vite";

import ReportFilters from "./report-filters";

const meta = {
  title: "App/Reports/ReportFilters",
  component: ReportFilters,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    date: "2026-10-03",
    locationId: "all",
    locations: [
      { id: "a", name: "Centro" },
      { id: "b", name: "Norte" },
    ],
    onDateChange: () => {},
    onLocationChange: () => {},
  },
} satisfies Meta<typeof ReportFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SingleLocation: Story = {
  args: { locations: [{ id: "a", name: "Centro" }], locationId: "a" },
};
