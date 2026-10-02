import { Outlet, createFileRoute } from "@tanstack/react-router";

import Loader from "@/shared/components/feedback/loader";
import NoPermission from "@/shared/components/feedback/no-permission";
import PageHeader from "@/shared/components/layout/page-header";
import SectionNav from "@/shared/components/layout/section-nav";
import { authClient } from "@/app/auth-client";
import { getSectionItems } from "@/app/navigation";
import { useNavContext } from "@/app/use-nav-context";
import { isSuperadminRole } from "@/features/access-control";

/**
 * Shared layout and guard for the platform admin area (docs/specs/auth-multitenant-rbac.md §7
 * `/admin/*`, R6.5): superadmins only, including against org owners. UX only; every
 * `platformRouter` procedure re-checks. Renders `NoPermission` rather than redirecting.
 * See docs/architecture/web-app.md#admin-area.
 */
export const Route = createFileRoute("/_auth/admin")({
  component: AdminLayout,
  staticData: { appShell: true },
});

function AdminLayout() {
  const { data: session, isPending } = authClient.useSession();
  const navContext = useNavContext();

  if (isPending) {
    return <Loader />;
  }
  if (!isSuperadminRole(session?.user.role)) {
    return <NoPermission message="Platform administration is restricted to superadmins." />;
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <PageHeader title="Platform administration" />
      <SectionNav label="Platform administration" items={getSectionItems("admin", navContext)} />
      <Outlet />
    </div>
  );
}
