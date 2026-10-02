import { Separator } from "@base-template/ui/components/separator";
import { SidebarTrigger } from "@base-template/ui/components/sidebar";
import type { ReactNode } from "react";

/**
 * Top bar inside the shell: fixed `h-12`, page background and a bottom border. Sidebar
 * trigger, separator and the `breadcrumb` slot on the left; `children` (actions) on the right.
 */
export default function AppHeader({
  breadcrumb,
  children,
}: {
  breadcrumb?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background">
      <div className="flex min-w-0 flex-1 items-center gap-2 px-4 sm:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        {breadcrumb}
      </div>
      <div className="flex items-center gap-2 px-4 sm:px-6">{children}</div>
    </header>
  );
}
