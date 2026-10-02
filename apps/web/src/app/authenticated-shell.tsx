import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { navGroups } from "@/app/navigation";
import { useNavContext } from "@/app/use-nav-context";
import { ImpersonationBanner } from "@/features/admin";
import { UserMenu } from "@/features/auth";
import { OrgSwitcher } from "@/features/organizations";
import AppBreadcrumbs from "@/shared/components/layout/app-breadcrumbs";
import AppShell from "@/shared/components/layout/app-shell";
import { ModeToggle } from "@/shared/components/layout/mode-toggle";
import { filterNavGroups, getBreadcrumbs } from "@/shared/lib/navigation";

/**
 * Wires the presentational `AppShell` to the app: nav config, the superadmin
 * visibility context, the sidebar org switcher and user menu, the breadcrumb
 * derived from the nav config and the impersonation banner.
 */
export default function AuthenticatedShell({ children }: { children: ReactNode }) {
  const navContext = useNavContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const breadcrumbs = getBreadcrumbs(filterNavGroups(navGroups, navContext), pathname);

  return (
    <AppShell
      navGroups={navGroups}
      navContext={navContext}
      sidebarHeader={<OrgSwitcher variant="sidebar" />}
      sidebarFooter={<UserMenu variant="sidebar" />}
      breadcrumb={<AppBreadcrumbs items={breadcrumbs} />}
      banner={<ImpersonationBanner />}
      headerActions={<ModeToggle />}
    >
      {children}
    </AppShell>
  );
}
