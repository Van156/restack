import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@base-template/ui/components/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@base-template/ui/components/button-group";

const meta = {
  title: "UI/Actions/ButtonGroup",
  component: ButtonGroup,
  tags: ["autodocs"],
  argTypes: {
    orientation: { control: "select", options: ["horizontal", "vertical"] },
  },
  args: {
    "aria-label": "Text alignment",
    children: (
      <>
        <Button variant="outline">Left</Button>
        <Button variant="outline">Center</Button>
        <Button variant="outline">Right</Button>
      </>
    ),
  },
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Vertical: Story = { args: { orientation: "vertical" } };

export const WithSeparator: Story = {
  args: {
    "aria-label": "Message actions",
    children: (
      <>
        <Button variant="secondary">Reply</Button>
        <ButtonGroupSeparator />
        <Button variant="secondary">Forward</Button>
      </>
    ),
  },
};

export const WithText: Story = {
  args: {
    "aria-label": "Pagination",
    children: (
      <>
        <Button variant="outline" size="icon" aria-label="Previous page">
          <ChevronLeftIcon />
        </Button>
        <ButtonGroupText>Page 2 of 8</ButtonGroupText>
        <Button variant="outline" size="icon" aria-label="Next page">
          <ChevronRightIcon />
        </Button>
      </>
    ),
  },
};

export const Disabled: Story = {
  args: {
    "aria-label": "Disabled actions",
    children: (
      <>
        <Button variant="outline" disabled>
          Left
        </Button>
        <Button variant="outline" disabled>
          Right
        </Button>
      </>
    ),
  },
};
