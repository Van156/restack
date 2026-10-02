import { LayoutDashboardIcon, SettingsIcon, ShieldCheckIcon } from "lucide-react";

import SidebarOrgSwitcher from "@/shared/components/layout/sidebar-org-switcher";
import SidebarUserMenu from "@/shared/components/layout/sidebar-user-menu";
import type { NavGroup } from "@/shared/lib/navigation";

/** Deterministic fixtures shared by the AppSidebar and AppShell stories. */
export type FixtureNavContext = { isSuperadmin: boolean };

export const fixtureGroups: NavGroup<FixtureNavContext>[] = [
  {
    label: "Dashboard",
    items: [{ label: "Dashboard", to: "/dashboard", icon: LayoutDashboardIcon }],
  },
  {
    label: "Organization",
    items: [
      {
        label: "Settings",
        to: "/settings/general",
        icon: SettingsIcon,
        children: [
          { label: "General", to: "/settings/general" },
          { label: "Members", to: "/settings/members" },
          { label: "Roles", to: "/settings/roles" },
        ],
      },
    ],
  },
  {
    label: "Platform",
    visible: (ctx) => ctx.isSuperadmin,
    items: [
      {
        label: "Admin",
        to: "/admin/users",
        icon: ShieldCheckIcon,
        children: [
          { label: "Users", to: "/admin/users" },
          { label: "Organizations", to: "/admin/organizations" },
        ],
      },
    ],
  },
];

const noop = () => {};

export const fixtureHeader = (
  <SidebarOrgSwitcher
    organizations={[
      { id: "org_acme", name: "Acme Inc" },
      { id: "org_globex", name: "Globex Corporation" },
    ]}
    activeOrganizationId="org_acme"
    onSelect={noop}
  />
);

export const fixtureFooter = (
  <SidebarUserMenu user={{ name: "Ada Lovelace", email: "ada@example.com" }} onSignOut={noop} />
);
