import { Outlet } from "@tanstack/react-router";

import PublicHeader from "@/app/public-header";
import { ImpersonationBanner } from "@/features/admin";

/** Layout for routes without the app shell: impersonation banner, top header, then the page. */
export default function PublicShell() {
  return (
    <div className="grid grid-rows-[auto_auto_1fr] h-svh">
      <ImpersonationBanner />
      <PublicHeader />
      <Outlet />
    </div>
  );
}
