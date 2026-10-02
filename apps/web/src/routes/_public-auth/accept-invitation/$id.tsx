import { createFileRoute } from "@tanstack/react-router";
import z from "zod";

import { AcceptInvitationPage } from "@/features/invitations";

/** R2: accept-invitation, public → auth (docs/specs/auth-multitenant-rbac.md §7). */
export const Route = createFileRoute("/_public-auth/accept-invitation/$id")({
  validateSearch: z.object({
    // Present only for the signed-out sign-up-via-invitation flow (R2.4);
    // never trusted as the sole proof — the server re-validates it.
    token: z.string().optional(),
    // Set by better-auth when a Google sign-up round trip fails (R5.3, R5.5).
    error: z.string().optional(),
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useParams();
  const { token, error } = Route.useSearch();
  return <AcceptInvitationPage invitationId={id} token={token} oauthError={error} />;
}
