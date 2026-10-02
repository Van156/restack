import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AuthLayout } from "@/features/auth";

/**
 * Pathless layout for the auth screens (sign-in, sign-up, verify-email, forgot-password, reset-password,
 * accept-invitation): split ink brand panel + form column, no `PublicHeader`.
 */
export const Route = createFileRoute("/_public-auth")({
  component: PublicAuthLayout,
});

function PublicAuthLayout() {
  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  );
}
