import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/app/auth-client";
import { signInRedirect } from "@/features/auth";
import AuthenticatedShell from "@/app/authenticated-shell";
import { useUsesAppShell } from "@/app/route-static-data";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect(signInRedirect());
    }
    return { session };
  },
});

/**
 * Mounts the app shell once for child routes with `staticData: { appShell: true }` (`_org`,
 * `admin`), so the sidebar stays mounted between them. Onboarding renders bare.
 */
function AuthLayout() {
  const usesAppShell = useUsesAppShell();

  if (!usesAppShell) {
    return <Outlet />;
  }
  return (
    <AuthenticatedShell>
      <Outlet />
    </AuthenticatedShell>
  );
}
