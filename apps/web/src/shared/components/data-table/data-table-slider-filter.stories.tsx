import type { Meta, StoryObj } from "@storybook/react-vite";

import { useMemberTable } from "./data-table-fixtures";
import { DataTableSliderFilter } from "./data-table-slider-filter";

function SliderExample({ initialSearch }: { initialSearch?: unknown }) {
  const { table } = useMemberTable({ initialSearch });
  const column = table.getColumn("score");
  return column ? <DataTableSliderFilter column={column} title="Score" /> : null;
}

const meta = {
  title: "App/DataTable/DataTableSliderFilter",
  component: SliderExample,
  tags: ["autodocs"],
} satisfies Meta<typeof SliderExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = { args: { initialSearch: { score: "25,75" } } };
