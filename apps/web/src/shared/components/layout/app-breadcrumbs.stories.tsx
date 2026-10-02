import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import AppBreadcrumbs from "./app-breadcrumbs";

const meta = {
  title: "App/Layout/AppBreadcrumbs",
  component: AppBreadcrumbs,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  // Links render TanStack `Link`, which needs a router context.
  decorators: [withRouter],
  args: { items: [{ label: "Organization settings" }, { label: "Members" }] },
} satisfies Meta<typeof AppBreadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SingleItem: Story = {
  args: { items: [{ label: "Dashboard" }] },
};

export const WithLinkedParent: Story = {
  args: {
    items: [
      { label: "Organization settings" },
      { label: "Access", to: "/settings/invitations" },
      { label: "Roles" },
    ],
  },
};

/** Earlier crumbs are hidden below `md`. */
export const Mobile: Story = {
  ...WithLinkedParent,
  globals: { viewport: { value: "mobile1", isRotated: false } },
};

export const Empty: Story = {
  args: { items: [] },
};
