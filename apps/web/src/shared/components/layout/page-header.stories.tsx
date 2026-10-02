import { Button } from "@base-template/ui/components/button";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import PageHeader from "./page-header";

const meta = {
  title: "App/Layout/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  // Breadcrumb links render TanStack `Link`, which needs a router context.
  decorators: [withRouter],
  args: { title: "Members" },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescriptionAndActions: Story = {
  args: {
    description: "People with access to this organization.",
    actions: <Button size="sm">Invite member</Button>,
  },
};

export const WithBreadcrumbs: Story = {
  args: {
    breadcrumbs: [{ label: "Settings", to: "/" }, { label: "Members" }],
  },
};
