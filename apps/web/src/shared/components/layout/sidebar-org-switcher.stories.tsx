import {
  Sidebar,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@base-template/ui/components/sidebar";
import type { Meta, StoryObj } from "@storybook/react-vite";

import SidebarOrgSwitcher from "./sidebar-org-switcher";

const organizations = [
  { id: "org_acme", name: "Acme Inc" },
  { id: "org_globex", name: "Globex Corporation" },
  { id: "org_long", name: "A very long organization name that must truncate in the sidebar" },
];

const noop = () => {};

const meta = {
  title: "App/Layout/SidebarOrgSwitcher",
  component: SidebarOrgSwitcher,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    // The sidebar is `position: fixed`; render docs in an iframe so it does not cover the docs page.
    docs: { story: { inline: false, iframeHeight: 360 } },
  },
  args: {
    organizations,
    activeOrganizationId: "org_acme",
    activeRole: "owner",
    onSelect: noop,
  },
  render: (args, { parameters }) => (
    <SidebarProvider defaultOpen={parameters.sidebarOpen !== false}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarOrgSwitcher {...args} />
        </SidebarHeader>
      </Sidebar>
      <SidebarInset />
    </SidebarProvider>
  ),
} satisfies Meta<typeof SidebarOrgSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A single organization still shows the switcher (decision 12). */
export const SingleOrganization: Story = {
  args: { organizations: [organizations[0]!] },
};

export const WithCreate: Story = {
  args: { onCreate: noop },
};

export const LongName: Story = {
  args: { activeOrganizationId: "org_long" },
};

/** The session has no (or an unknown) active organization: explicit prompt, no mislabeling. */
export const NoActiveOrganization: Story = {
  args: { activeOrganizationId: null },
};

export const Loading: Story = {
  args: { isLoading: true },
};

/** Empty list renders nothing. */
export const Empty: Story = {
  args: { organizations: [] },
};

export const IconCollapsed: Story = {
  parameters: { sidebarOpen: false },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
