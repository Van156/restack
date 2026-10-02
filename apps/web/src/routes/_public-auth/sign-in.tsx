import { createFileRoute } from "@tanstack/react-router";

import { SignInPage, authSearchSchema } from "@/features/auth";

export const Route = createFileRoute("/_public-auth/sign-in")({
  validateSearch: authSearchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  return <SignInPage search={Route.useSearch()} />;
}
