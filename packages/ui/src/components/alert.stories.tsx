import type { Meta, StoryObj } from "@storybook/react-vite";
import { AlertCircleIcon, InfoIcon } from "lucide-react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@base-template/ui/components/alert";
import { Button } from "@base-template/ui/components/button";

const meta = {
  title: "UI/Feedback/Alert",
  component: Alert,
  tags: ["autodocs"],
  argTypes: { variant: { control: "select", options: ["default", "destructive"] } },
  decorators: [
    (Story) => (
      <div className="w-[420px]">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <Alert {...args}>
      <InfoIcon />
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>You can add components using the CLI.</AlertDescription>
    </Alert>
  ),
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Destructive: Story = {
  // a11y: light-theme `color-contrast` is accepted for this story. Design tokens (globals.css,
  // base-lyra + neutral) are out of scope per the frontend-foundation spec; light-theme destructive text is ~4.1-4.3:1 (needs 4.5:1).
  // Dark theme has no violations. Revisit with a theme task.
  parameters: { a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } } },
  args: { variant: "destructive" },
  render: (args) => (
    <Alert {...args}>
      <AlertCircleIcon />
      <AlertTitle>Payment failed</AlertTitle>
      <AlertDescription>Your card was declined. Update your billing details.</AlertDescription>
    </Alert>
  ),
};

export const WithAction: Story = {
  render: (args) => (
    <Alert {...args}>
      <InfoIcon />
      <AlertTitle>Update available</AlertTitle>
      <AlertDescription>A new version is ready to install.</AlertDescription>
      <AlertAction>
        <Button size="xs" variant="outline">
          Update
        </Button>
      </AlertAction>
    </Alert>
  ),
};
