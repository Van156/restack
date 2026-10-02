import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@base-template/ui/components/native-select";

const meta = {
  title: "UI/Forms/NativeSelect",
  component: NativeSelect,
  tags: ["autodocs"],
  args: {
    "aria-label": "Fruit",
    defaultValue: "",
    children: (
      <>
        <NativeSelectOption value="">Select a fruit</NativeSelectOption>
        <NativeSelectOption value="apple">Apple</NativeSelectOption>
        <NativeSelectOption value="banana">Banana</NativeSelectOption>
        <NativeSelectOption value="cherry">Cherry</NativeSelectOption>
      </>
    ),
  },
  argTypes: {
    size: { control: "select", options: ["default", "sm"] },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof NativeSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = { args: { size: "sm" } };

export const WithGroups: Story = {
  args: {
    "aria-label": "Produce",
    children: (
      <>
        <NativeSelectOption value="">Select produce</NativeSelectOption>
        <NativeSelectOptGroup label="Fruits">
          <NativeSelectOption value="apple">Apple</NativeSelectOption>
          <NativeSelectOption value="banana">Banana</NativeSelectOption>
        </NativeSelectOptGroup>
        <NativeSelectOptGroup label="Vegetables">
          <NativeSelectOption value="carrot">Carrot</NativeSelectOption>
          <NativeSelectOption value="leek">Leek</NativeSelectOption>
        </NativeSelectOptGroup>
      </>
    ),
  },
};

export const Disabled: Story = { args: { disabled: true } };

export const Invalid: Story = { args: { "aria-invalid": true } };
