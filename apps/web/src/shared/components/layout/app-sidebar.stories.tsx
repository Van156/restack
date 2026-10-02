import { SidebarInset, SidebarProvider } from "@base-template/ui/components/sidebar";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  fixtureFooter,
  fixtureGroups,
  fixtureHeader,
  type FixtureNavContext as Ctx,
} from "@/shared/storybook/app-shell-fixtures";
import { withRouter } from "@/shared/storybook/with-router";

import AppSidebar from "./app-sidebar";

const meta = {
  title: "App/Layout/AppSidebar",
  component: AppSidebar<Ctx>,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    // The sidebar is `position: fixed`; render docs in an iframe so it does not cover the docs page.
    docs: { story: { inline: false, iframeHeight: 520 } },
  },
  args: {
    groups: fixtureGroups,
    context: { isSuperadmin: true },
    header: fixtureHeader,
    footer: fixtureFooter,
  },
  decorators: [withRouter],
  render: (args, { parameters }) => (
    <SidebarProvider defaultOpen={parameters.sidebarOpen !== false}>
      <AppSidebar {...args} />
      <SidebarInset />
    </SidebarProvider>
  ),
} satisfies Meta<typeof AppSidebar<Ctx>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {};

/** The sidebar is an ink panel in both modes; this pins the light theme for contrast review. */
export const Light: Story = {
  globals: { theme: "light" },
  parameters: { routerPath: "/settings/members" },
};

/** Labels and sub-items hide; buttons keep tooltips; the rail toggles it back. */
export const IconCollapsed: Story = {
  parameters: { sidebarOpen: false },
};

/** A member does not see the superadmin-only group. */
export const Member: Story = {
  args: { context: { isSuperadmin: false } },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};

/** The parent of the active child route starts open; toggling it still works. */
export const ChildRouteActive: Story = {
  parameters: { routerPath: "/settings/members" },
};
