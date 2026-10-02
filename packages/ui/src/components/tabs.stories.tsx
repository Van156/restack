import type { Meta, StoryObj } from "@storybook/react-vite";

import { Input } from "@base-template/ui/components/input";
import { Label } from "@base-template/ui/components/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@base-template/ui/components/tabs";

function Panels() {
  return (
    <>
      <TabsContent value="account" className="grid gap-2 pt-3">
        <Label htmlFor="tabs-name">Name</Label>
        <Input id="tabs-name" defaultValue="Ada Lovelace" />
      </TabsContent>
      <TabsContent value="password" className="grid gap-2 pt-3">
        <Label htmlFor="tabs-password">New password</Label>
        <Input id="tabs-password" type="password" defaultValue="correct horse" />
      </TabsContent>
      <TabsContent value="notifications" className="pt-3">
        Choose which notifications you receive.
      </TabsContent>
    </>
  );
}

const meta = {
  title: "UI/Navigation/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  args: { defaultValue: "account" },
  argTypes: { orientation: { control: "select", options: ["horizontal", "vertical"] } },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <Tabs {...args}>
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
      </TabsList>
      <Panels />
    </Tabs>
  ),
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Line: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList variant="line">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
      </TabsList>
      <Panels />
    </Tabs>
  ),
};

export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <Tabs {...args} className="flex-row">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
      </TabsList>
      <div className="flex-1 px-3">
        <Panels />
      </div>
    </Tabs>
  ),
};

export const WithDisabledTab: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
        <TabsTrigger value="notifications" disabled>
          Notifications
        </TabsTrigger>
      </TabsList>
      <Panels />
    </Tabs>
  ),
};
