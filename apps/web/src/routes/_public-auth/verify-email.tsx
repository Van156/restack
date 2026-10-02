import { createFileRoute } from "@tanstack/react-router";
import z from "zod";

import { VerifyEmailPage } from "@/features/auth";

export const Route = createFileRoute("/_public-auth/verify-email")({
  validateSearch: z.object({
    error: z.string().optional(),
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { error } = Route.useSearch();
  return <VerifyEmailPage error={error} />;
}
