import { Outlet, createFileRoute } from "@tanstack/react-router";

import { getSectionItems } from "@/app/navigation";
import { useNavContext } from "@/app/use-nav-context";
import PageHeader from "@/shared/components/layout/page-header";
import SectionNav from "@/shared/components/layout/section-nav";

/**
 * Shared layout for the organization settings pages (docs/specs/auth-multitenant-rbac.md §7): page
 * title and `SectionNav` tabs. General, invitations, roles and activity gate their content with
 * `CanGate`; members deliberately does not.
 * See docs/architecture/web-app.md#permission-gated-pages.
 */
export const Route = createFileRoute("/_auth/_org/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const navContext = useNavContext();
  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <PageHeader title="Organization settings" />
      <SectionNav label="Organization settings" items={getSectionItems("settings", navContext)} />
      <Outlet />
    </div>
  );
}
