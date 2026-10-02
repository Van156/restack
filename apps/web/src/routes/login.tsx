import { createFileRoute, redirect } from "@tanstack/react-router";

import { signInRedirect } from "@/features/auth";

/** Legacy `/login`: permanently replaced by `/sign-in`; `redirect`/`invitationId` are preserved. */
export const Route = createFileRoute("/login")({
  beforeLoad: ({ search }) => {
    throw redirect(signInRedirect(search as Record<string, unknown>));
  },
});
