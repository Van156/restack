import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import {
  Faceted,
  FacetedBadgeList,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedList,
  FacetedTrigger,
} from "@base-template/ui/components/faceted";
import { Button } from "@base-template/ui/components/button";

const options = [
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Suspended", value: "suspended" },
  { label: "Archived", value: "archived" },
];

function Options() {
  return (
    <FacetedContent aria-label="Options">
      <FacetedInput placeholder="Search status..." aria-label="Search status" />
      <FacetedList>
        <FacetedEmpty>No results found.</FacetedEmpty>
        <FacetedGroup>
          {options.map((option) => (
            <FacetedItem key={option.value} value={option.value}>
              {option.label}
            </FacetedItem>
          ))}
        </FacetedGroup>
      </FacetedList>
    </FacetedContent>
  );
}

function SingleExample({ initial }: { initial?: string }) {
  const [value, setValue] = useState<string | undefined>(initial);
  return (
    <Faceted value={value} onValueChange={setValue}>
      <FacetedTrigger render={<Button variant="outline" className="w-56" />}>
        <FacetedBadgeList options={options} placeholder="Select status..." />
      </FacetedTrigger>
      <Options />
    </Faceted>
  );
}

function MultipleExample({ initial = [] }: { initial?: string[] }) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <Faceted multiple value={value} onValueChange={(next) => setValue(next ?? [])}>
      <FacetedTrigger render={<Button variant="outline" className="w-56" />}>
        <FacetedBadgeList options={options} max={2} placeholder="Select statuses..." />
      </FacetedTrigger>
      <Options />
    </Faceted>
  );
}

const meta = {
  title: "UI/Forms/Faceted",
  component: Faceted,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof Faceted>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <SingleExample />,
};

export const SingleSelected: Story = {
  render: () => <SingleExample initial="active" />,
};

export const Multiple: Story = {
  render: () => <MultipleExample initial={["active", "pending"]} />,
};

export const MultipleOverflow: Story = {
  render: () => <MultipleExample initial={["active", "pending", "archived"]} />,
};

export const Open: Story = {
  render: () => (
    <Faceted open multiple value={["active"]} onValueChange={() => {}}>
      <FacetedTrigger render={<Button variant="outline" className="w-56" />}>
        <FacetedBadgeList options={options} placeholder="Select statuses..." />
      </FacetedTrigger>
      <Options />
    </Faceted>
  ),
};
