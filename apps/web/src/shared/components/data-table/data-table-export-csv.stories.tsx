import type { Meta, StoryObj } from "@storybook/react-vite";

import type { CsvColumn } from "@/shared/lib/data-table/csv";

import { DataTableExportCsv } from "./data-table-export-csv";

type Row = { name: string; note: string };

const rows: Row[] = [
  { name: "Ada Lovelace", note: "Wrote the first program" },
  { name: "Grace Hopper", note: 'Coined "debugging", maybe' },
];

const columns: CsvColumn<Row>[] = [
  { header: "Name", value: (row) => row.name },
  { header: "Note", value: (row) => row.note },
];

const meta = {
  title: "App/DataTable/DataTableExportCsv",
  component: DataTableExportCsv<Row>,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { rows, columns, filename: "members.csv" },
} satisfies Meta<typeof DataTableExportCsv<Row>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomLabel: Story = { args: { label: "Download selected" } };

export const NoRows: Story = { args: { rows: [] } };
