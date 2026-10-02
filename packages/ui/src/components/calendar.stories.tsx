import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { Calendar } from "@base-template/ui/components/calendar";

const meta = {
  title: "UI/Forms/Calendar",
  component: Calendar,
  tags: ["autodocs"],
  args: { defaultMonth: new Date(2026, 0, 1), today: new Date(2026, 0, 15) },
  argTypes: {
    showOutsideDays: { control: "boolean" },
    captionLayout: {
      control: "select",
      options: ["label", "dropdown", "dropdown-months", "dropdown-years"],
    },
    buttonVariant: { control: "select", options: ["ghost", "outline", "secondary"] },
  },
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Single: Story = {
  render: (args) => {
    const [selected, setSelected] = useState<Date | undefined>(new Date(2026, 0, 15));
    return <Calendar {...args} mode="single" selected={selected} onSelect={setSelected} />;
  },
};

export const Range: Story = {
  render: (args) => {
    const [selected, setSelected] = useState<DateRange | undefined>({
      from: new Date(2026, 0, 12),
      to: new Date(2026, 0, 18),
    });
    return <Calendar {...args} mode="range" selected={selected} onSelect={setSelected} />;
  },
};

export const TwoMonths: Story = {
  render: (args) => {
    const [selected, setSelected] = useState<DateRange | undefined>({
      from: new Date(2026, 0, 28),
      to: new Date(2026, 1, 3),
    });
    return (
      <Calendar
        {...args}
        mode="range"
        numberOfMonths={2}
        selected={selected}
        onSelect={setSelected}
      />
    );
  },
};

export const DropdownCaption: Story = {
  args: { captionLayout: "dropdown", startMonth: new Date(2020, 0), endMonth: new Date(2030, 11) },
};

export const DisabledDates: Story = {
  render: (args) => {
    const [selected, setSelected] = useState<Date | undefined>(new Date(2026, 0, 15));
    return (
      <Calendar
        {...args}
        mode="single"
        selected={selected}
        onSelect={setSelected}
        disabled={[{ before: new Date(2026, 0, 10) }, { dayOfWeek: [0, 6] }]}
      />
    );
  },
};

export const WithoutOutsideDays: Story = { args: { showOutsideDays: false } };
