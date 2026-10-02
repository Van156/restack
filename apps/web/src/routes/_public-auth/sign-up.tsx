import { createFileRoute } from "@tanstack/react-router";

import { SignUpPage, authSearchSchema } from "@/features/auth";

export const Route = createFileRoute("/_public-auth/sign-up")({
  validateSearch: authSearchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  return <SignUpPage search={Route.useSearch()} />;
}
