import { LayoutDashboard, Settings, ShieldCheck, Store, UserRound } from "lucide-react";

import type { SectionNavItem } from "@/shared/components/layout/section-nav";
import { filterNavGroups, flattenNavItems, type NavGroup } from "@/shared/lib/navigation";

/** Inputs to the sidebar items' `visible` predicates. */
export type NavContext = {
  isSuperadmin: boolean;
  /**
   * Whether the user belongs to (or is still resolving) at least one organization. Org-scoped
   * links bounce a user with none to `/onboarding`, so they are hidden instead.
   */
  hasOrganization: boolean;
};

/**
 * `hasOrganization` for `NavContext`. Optimistic while the organization list is loading, so the
 * org links do not flash away on every page load, and while a failed list lookup is unresolved
 * (`hasError`): an unknown membership must not hide links a member may need. A member with organizations but none active
 * keeps the links: the `_org` route guard activates their first membership on arrival.
 */
export function resolveHasOrganization({
  activeOrganizationId,
  organizationCount,
  isLoading,
  hasError = false,
}: {
  activeOrganizationId: string | null | undefined;
  organizationCount: number | undefined;
  isLoading: boolean;
  hasError?: boolean;
}): boolean {
  return Boolean(activeOrganizationId) || isLoading || hasError || (organizationCount ?? 0) > 0;
}

const hasOrganization = (ctx: NavContext) => ctx.hasOrganization;

/**
 * Sidebar navigation for the authenticated shell. Visibility is UX only: every
 * page keeps its own permission gate (`CanGate`, the admin layout check) and
 * every procedure re-checks on the server (R6.5).
 */
export const navGroups: NavGroup<NavContext>[] = [
  {
    label: "Dashboard",
    visible: hasOrganization,
    items: [{ label: "Dashboard", to: "/dashboard", icon: LayoutDashboard }],
  },
  {
    id: "restaurant",
    label: "Restaurante",
    visible: hasOrganization,
    items: [
      {
        label: "Restaurante",
        to: "/restaurant/locations",
        icon: Store,
        children: [
          { label: "Mesas", to: "/restaurant/waiter" },
          { label: "Locales", to: "/restaurant/locations" },
          { label: "Configuración", to: "/restaurant/setup" },
          { label: "Equipo", to: "/restaurant/staff" },
          { label: "Dispositivos", to: "/restaurant/devices" },
          { label: "Mi PIN", to: "/restaurant/pin" },
        ],
      },
    ],
  },
  {
    id: "settings",
    label: "Organization",
    visible: hasOrganization,
    items: [
      {
        label: "Settings",
        to: "/settings/general",
        icon: Settings,
        children: [
          { label: "General", to: "/settings/general" },
          { label: "Members", to: "/settings/members" },
          { label: "Invitations", to: "/settings/invitations" },
          { label: "Roles", to: "/settings/roles" },
          { label: "Activity", to: "/settings/activity" },
        ],
      },
    ],
  },
  {
    id: "account",
    label: "Personal",
    items: [
      {
        label: "Account settings",
        to: "/account/profile",
        icon: UserRound,
        children: [
          { label: "Profile", to: "/account/profile" },
          { label: "Security", to: "/account/security" },
          { label: "Preferences", to: "/account/preferences" },
          { label: "Danger zone", to: "/account/danger" },
        ],
      },
    ],
  },
  {
    id: "admin",
    label: "Platform",
    visible: (ctx) => ctx.isSuperadmin,
    items: [
      {
        label: "Admin",
        to: "/admin/users",
        icon: ShieldCheck,
        children: [
          { label: "Users", to: "/admin/users" },
          { label: "Organizations", to: "/admin/organizations" },
          { label: "Activity", to: "/admin/activity" },
        ],
      },
    ],
  },
];

/**
 * Tab items for a section layout (`settings`, `admin`), derived from the
 * sidebar config with the same visibility predicates and context, so both
 * navigations always list the same pages.
 */
export function getSectionItems(
  sectionId: "restaurant" | "settings" | "account" | "admin",
  context: NavContext,
): SectionNavItem[] {
  return deriveSectionItems(navGroups, sectionId, context);
}

/** Pure core of `getSectionItems`, taking the config so tests can use a local fixture. */
export function deriveSectionItems(
  groups: NavGroup<NavContext>[],
  sectionId: string,
  context: NavContext,
): SectionNavItem[] {
  const group = filterNavGroups(groups, context).find((candidate) => candidate.id === sectionId);
  return flattenNavItems(group?.items ?? []).map(({ to, label }) => ({ to, label }));
}
