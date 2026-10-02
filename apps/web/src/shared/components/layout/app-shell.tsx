import { SidebarInset, SidebarProvider } from "@base-template/ui/components/sidebar";
import type { ReactNode } from "react";

import type { NavGroup } from "@/shared/lib/navigation";

import AppHeader from "./app-header";
import AppSidebar from "./app-sidebar";

/**
 * Authenticated app frame: icon-collapsible sidebar (a sheet on narrow
 * viewports), bordered header and content. Everything domain-specific arrives
 * through props/slots so `shared/` stays free of feature imports.
 */
export default function AppShell<Ctx>({
  navGroups,
  navContext,
  sidebarHeader,
  sidebarFooter,
  breadcrumb,
  banner,
  headerActions,
  defaultSidebarOpen = true,
  children,
}: {
  navGroups: NavGroup<Ctx>[];
  navContext: Ctx;
  /** Sidebar header slot, e.g. the organization switcher. */
  sidebarHeader?: ReactNode;
  /** Sidebar footer slot, e.g. the user menu. */
  sidebarFooter?: ReactNode;
  /** Header breadcrumb slot. */
  breadcrumb?: ReactNode;
  /** Rendered above the header, e.g. the impersonation banner. */
  banner?: ReactNode;
  /** Controls on the right of the header (theme toggle). */
  headerActions?: ReactNode;
  /** Initial sidebar state (expanded by default; `false` starts icon-collapsed). */
  defaultSidebarOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <AppSidebar
        groups={navGroups}
        context={navContext}
        header={sidebarHeader}
        footer={sidebarFooter}
      />
      <SidebarInset>
        {banner}
        <AppHeader breadcrumb={breadcrumb}>{headerActions}</AppHeader>
        <div className="flex flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
