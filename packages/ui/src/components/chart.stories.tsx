import type { Meta, StoryObj } from "@storybook/react-vite";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@base-template/ui/components/chart";

const data = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
];

const config = {
  desktop: { label: "Desktop", color: "var(--chart-1)" },
  mobile: { label: "Mobile", color: "var(--chart-2)" },
} satisfies ChartConfig;

const axis = (
  <XAxis
    dataKey="month"
    tickLine={false}
    axisLine={false}
    tickMargin={8}
    tickFormatter={(value: string) => value.slice(0, 3)}
  />
);

const meta = {
  title: "UI/Data display/Chart",
  component: ChartContainer,
  tags: ["autodocs"],
  args: { config, children: <></> },
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="w-[480px]">
        <Story />
      </div>
    ),
  ],
  // Static data, fixed initial dimension: output is deterministic.
  render: (args) => (
    <ChartContainer {...args} aria-label="Visitors per month, bar chart" role="img">
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        {axis}
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="desktop" fill="var(--color-desktop)" radius={0} />
        <Bar dataKey="mobile" fill="var(--color-mobile)" radius={0} />
      </BarChart>
    </ChartContainer>
  ),
} satisfies Meta<typeof ChartContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Bars: Story = {};

export const Lines: Story = {
  render: (args) => (
    <ChartContainer {...args} aria-label="Visitors per month, line chart" role="img">
      <LineChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        {axis}
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line dataKey="desktop" type="monotone" stroke="var(--color-desktop)" dot={false} />
        <Line dataKey="mobile" type="monotone" stroke="var(--color-mobile)" dot={false} />
      </LineChart>
    </ChartContainer>
  ),
};

export const Areas: Story = {
  render: (args) => (
    <ChartContainer {...args} aria-label="Visitors per month, area chart" role="img">
      <AreaChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        {axis}
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="mobile"
          type="natural"
          fill="var(--color-mobile)"
          fillOpacity={0.4}
          stroke="var(--color-mobile)"
          stackId="a"
        />
        <Area
          dataKey="desktop"
          type="natural"
          fill="var(--color-desktop)"
          fillOpacity={0.4}
          stroke="var(--color-desktop)"
          stackId="a"
        />
      </AreaChart>
    </ChartContainer>
  ),
};
