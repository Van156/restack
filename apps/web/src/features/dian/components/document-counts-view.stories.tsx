import type { Meta, StoryObj } from "@storybook/react-vite";

import DocumentCountsView from "./document-counts-view";

const meta = {
  title: "App/Dian/DocumentCountsView",
  component: DocumentCountsView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    rows: [
      { month: "2026-10", label: "octubre de 2026", count: 5_100, overFairUse: true },
      { month: "2026-09", label: "septiembre de 2026", count: 740, overFairUse: false },
    ],
  },
} satisfies Meta<typeof DocumentCountsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
