import type { Meta, StoryObj } from "@storybook/react-vite";
import { GripVerticalIcon } from "lucide-react";
import { useState } from "react";

import {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
  SortableOverlay,
} from "@base-template/ui/components/sortable";

const initialItems = ["Name", "Email", "Role", "Created"];

function Row({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
      <span className="flex-1">{label}</span>
    </div>
  );
}

function VerticalExample({ disabledValue }: { disabledValue?: string }) {
  const [items, setItems] = useState(initialItems);
  return (
    <Sortable value={items} onValueChange={setItems}>
      <SortableContent className="flex w-64 flex-col gap-2">
        {items.map((item) => (
          <SortableItem key={item} value={item} disabled={item === disabledValue}>
            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
              <SortableItemHandle aria-label={`Reorder ${item}`} className="text-muted-foreground">
                <GripVerticalIcon className="size-4" />
              </SortableItemHandle>
              <span className="flex-1">{item}</span>
            </div>
          </SortableItem>
        ))}
      </SortableContent>
      <SortableOverlay>{({ value }) => <Row label={String(value)} />}</SortableOverlay>
    </Sortable>
  );
}

function HorizontalExample() {
  const [items, setItems] = useState(initialItems);
  return (
    <Sortable value={items} onValueChange={setItems} orientation="horizontal">
      <SortableContent className="flex gap-2">
        {items.map((item) => (
          <SortableItem key={item} value={item} asHandle>
            <div className="rounded-md border bg-card px-3 py-2 text-sm">{item}</div>
          </SortableItem>
        ))}
      </SortableContent>
      <SortableOverlay>{({ value }) => <Row label={String(value)} />}</SortableOverlay>
    </Sortable>
  );
}

const meta = {
  title: "UI/Data display/Sortable",
  component: Sortable,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof Sortable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: initialItems },
  render: () => <VerticalExample />,
};

export const Horizontal: Story = {
  args: { value: initialItems },
  render: () => <HorizontalExample />,
};

export const WithDisabledItem: Story = {
  args: { value: initialItems },
  render: () => <VerticalExample disabledValue="Role" />,
};
