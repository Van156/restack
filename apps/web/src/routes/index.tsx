import { createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/app/auth-client";
import { loadHomeRedirect } from "@/app/home-redirect";

/**
 * `/` has no page of its own: it forwards to `/dashboard` (whose `_org` guard handles the
 * no-organization case via `/onboarding`) or to `/sign-in`. A failed or rejected session lookup
 * is forwarded to `/dashboard` so the `_auth` guard decides.
 */
export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    throw redirect(await loadHomeRedirect(() => authClient.getSession()));
  },
});
