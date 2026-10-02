import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import type { ColumnFilter } from "@/shared/lib/data-table/types";

import { updateFilter } from "@/shared/lib/data-table/advanced";

import { memberColumns } from "./data-table-fixtures";
import { DataTableFilterOperator, DataTableFilterValue } from "./data-table-filter-value";

type ValueExampleProps = { initial: Omit<ColumnFilter, "filterId"> };

/** One filter row's operator and value controls, edited locally like the builders do. */
function FilterValueExample({ initial }: ValueExampleProps) {
  const [filter, setFilter] = useState<ColumnFilter>({ ...initial, filterId: "filter-1" });
  const column = memberColumns.find((candidate) => candidate.id === initial.id);
  const meta = column?.meta;
  const label = meta?.label ?? initial.id;
  const onChange = (updates: Partial<Omit<ColumnFilter, "filterId">>) =>
    setFilter((previous) => updateFilter([previous], "filter-1", updates)[0] ?? previous);

  return (
    <div className="flex w-96 flex-col gap-2">
      <DataTableFilterOperator filter={filter} label={label} onChange={onChange} />
      <DataTableFilterValue
        filter={filter}
        meta={meta}
        label={label}
        inputId={`value-${initial.id}`}
        onChange={onChange}
      />
    </div>
  );
}

const meta = {
  title: "App/DataTable/DataTableFilterValue",
  component: FilterValueExample,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof FilterValueExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {
  args: { initial: { id: "name", variant: "text", operator: "iLike", value: "ada" } },
};

export const Number: Story = {
  args: { initial: { id: "score", variant: "number", operator: "gt", value: "50" } },
};

export const Between: Story = {
  args: { initial: { id: "score", variant: "range", operator: "isBetween", value: ["20", "80"] } },
};

export const NoValueNeeded: Story = {
  args: { initial: { id: "name", variant: "text", operator: "isEmpty", value: "" } },
};

export const SingleSelect: Story = {
  args: { initial: { id: "status", variant: "select", operator: "eq", value: "active" } },
};

export const MultiSelect: Story = {
  args: {
    initial: {
      id: "role",
      variant: "multiSelect",
      operator: "inArray",
      value: ["admin", "member"],
    },
  },
};

export const Boolean: Story = {
  args: { initial: { id: "active", variant: "boolean", operator: "eq", value: "true" } },
};

export const SingleDate: Story = {
  args: {
    initial: {
      id: "joinedAt",
      variant: "date",
      operator: "gte",
      value: String(Date.UTC(2024, 2, 15, 12)),
    },
  },
};

export const DateRange: Story = {
  args: {
    initial: {
      id: "joinedAt",
      variant: "dateRange",
      operator: "isBetween",
      value: [String(Date.UTC(2024, 0, 1, 12)), String(Date.UTC(2024, 5, 30, 12))],
    },
  },
};
