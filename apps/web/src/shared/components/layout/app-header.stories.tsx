import { Button } from "@base-template/ui/components/button";
import { SidebarProvider } from "@base-template/ui/components/sidebar";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import AppBreadcrumbs from "./app-breadcrumbs";
import AppHeader from "./app-header";

const meta = {
  title: "App/Layout/AppHeader",
  component: AppHeader,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    withRouter,
    (Story) => (
      <SidebarProvider>
        <div className="w-full">
          <Story />
        </div>
      </SidebarProvider>
    ),
  ],
} satisfies Meta<typeof AppHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActions: Story = {
  args: { children: <Button size="sm">Invite</Button> },
};

export const WithBreadcrumb: Story = {
  args: {
    breadcrumb: (
      <AppBreadcrumbs
        items={[
          { label: "Organization" },
          { label: "Settings", to: "/settings/general" },
          { label: "Members" },
        ]}
      />
    ),
    children: <Button size="sm">Invite</Button>,
  },
};
