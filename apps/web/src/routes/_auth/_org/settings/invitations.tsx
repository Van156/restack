import { createFileRoute } from "@tanstack/react-router";

import { InvitationsPage } from "@/features/invitations";

/** `/settings/invitations` (docs/specs/auth-multitenant-rbac.md §7, R2); the page lives in `features/invitations`. */
export const Route = createFileRoute("/_auth/_org/settings/invitations")({
  component: InvitationsPage,
});
