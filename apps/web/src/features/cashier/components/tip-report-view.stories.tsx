import type { Meta, StoryObj } from "@storybook/react-vite";

import TipReportView from "./tip-report-view";

const meta = {
  title: "App/Cashier/TipReportView",
  component: TipReportView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    period: { from: "2026-10-01", to: "2026-10-03" },
    periodError: null,
    onPeriodChange: () => {},
    report: {
      total: 18_000,
      people: [
        { key: "m1", displayName: "Ana Ruiz", amount: 11_000 },
        { key: "name:Chef Luis", displayName: "Chef Luis", amount: 7_000 },
      ],
      shifts: [
        {
          cashShiftId: "sh1",
          closedAt: "2026-10-02T23:30:00.000Z",
          tipTotal: 8_000,
          shares: [
            { key: "m1", displayName: "Ana Ruiz", amount: 5_000 },
            { key: "name:Chef Luis", displayName: "Chef Luis", amount: 3_000 },
          ],
        },
        {
          cashShiftId: "sh2",
          closedAt: "2026-10-03T23:30:00.000Z",
          tipTotal: 10_000,
          shares: [
            { key: "m1", displayName: "Ana Ruiz", amount: 6_000 },
            { key: "name:Chef Luis", displayName: "Chef Luis", amount: 4_000 },
          ],
        },
      ],
    },
  },
} satisfies Meta<typeof TipReportView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoShifts: Story = { args: { report: { shifts: [], people: [], total: 0 } } };

export const InvalidPeriod: Story = {
  args: {
    period: { from: "2026-10-05", to: "2026-10-01" },
    periodError: "La fecha final no puede ser anterior a la inicial.",
    report: null,
  },
};
