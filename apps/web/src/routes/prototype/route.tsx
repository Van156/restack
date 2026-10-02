import { Separator } from "@base-template/ui/components/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@base-template/ui/components/sidebar";
import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";

import { LabSidebar } from "./-lab-sidebar";

/**
 * Public, dev-only layout for the prototype lab. Outside `_auth`/`_public-auth`, so no session is
 * needed; production builds resolve it to not-found.
 */
export const Route = createFileRoute("/prototype")({
  beforeLoad: () => {
    if (import.meta.env.PROD) throw notFound();
  },
  component: PrototypeLayout,
});

function PrototypeLayout() {
  return (
    <SidebarProvider>
      <LabSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm text-muted-foreground">Prototype Lab</span>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
