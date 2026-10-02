import { createFileRoute } from "@tanstack/react-router";

import { ResetPasswordPage, resetPasswordSearchSchema } from "@/features/auth";

export const Route = createFileRoute("/_public-auth/reset-password")({
  validateSearch: resetPasswordSearchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  return <ResetPasswordPage search={Route.useSearch()} />;
}
