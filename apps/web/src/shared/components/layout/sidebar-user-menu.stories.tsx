import {
  Sidebar,
  SidebarFooter,
  SidebarInset,
  SidebarProvider,
} from "@base-template/ui/components/sidebar";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SettingsIcon } from "lucide-react";

import SidebarUserMenu from "./sidebar-user-menu";

// Inline SVG data URI keeps the story offline and deterministic.
const avatarImage =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#6366f1"/></svg>',
  );

const noop = () => {};

const meta = {
  title: "App/Layout/SidebarUserMenu",
  component: SidebarUserMenu,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 360 } },
  },
  args: {
    user: { name: "Ada Lovelace", email: "ada@example.com" },
    onSignOut: noop,
  },
  render: (args, { parameters }) => (
    <SidebarProvider defaultOpen={parameters.sidebarOpen !== false}>
      <Sidebar collapsible="icon">
        <SidebarFooter className="mt-auto">
          <SidebarUserMenu {...args} />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset />
    </SidebarProvider>
  ),
} satisfies Meta<typeof SidebarUserMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithImage: Story = {
  args: { user: { name: "Ada Lovelace", email: "ada@example.com", image: avatarImage } },
};

export const LongIdentity: Story = {
  args: {
    user: {
      name: "Augusta Ada King-Noel, Countess of Lovelace",
      email: "augusta.ada.king.noel.countess.of.lovelace@example.com",
    },
  },
};

export const WithExtraItems: Story = {
  args: { extraItems: [{ label: "Account settings", icon: <SettingsIcon />, onSelect: noop }] },
};

export const Loading: Story = {
  args: { isLoading: true },
};

/** Icon-collapsed sidebar: only the avatar remains; click opens the same menu. */
export const IconCollapsed: Story = {
  parameters: { sidebarOpen: false },
};

/** Below `md` the menu opens as a bottom drawer. */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
