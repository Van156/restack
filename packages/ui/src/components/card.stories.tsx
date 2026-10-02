import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "@base-template/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@base-template/ui/components/card";

const meta = {
  title: "UI/Data display/Card",
  component: Card,
  tags: ["autodocs"],
  argTypes: { size: { control: "select", options: ["default", "sm"] } },
  render: (args) => (
    <Card {...args} className="w-80">
      <CardHeader>
        <CardTitle>Project summary</CardTitle>
        <CardDescription>Status of the current sprint.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">12 of 18 tasks completed. Next review on Friday.</p>
      </CardContent>
    </Card>
  ),
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = { args: { size: "sm" } };

export const WithActionAndFooter: Story = {
  render: (args) => (
    <Card {...args} className="w-80">
      <CardHeader>
        <CardTitle>Team invitations</CardTitle>
        <CardDescription>Invite people to collaborate.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm">
            Manage
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm">3 pending invitations.</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button>Send reminder</Button>
        <Button variant="ghost">Dismiss</Button>
      </CardFooter>
    </Card>
  ),
};
