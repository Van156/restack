import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { betterAuthErrorMessage } from "@/features/auth";
import { decideOrgLanding } from "../lib/org-landing";
import { ORG_SCOPED_QUERY_ROOTS } from "../lib/org-query-keys";

/**
 * R10.2 / R11.4: returns the function that moves the user on after they left or deleted an
 * organization: activate the first remaining one and open the dashboard, else `/onboarding`. The
 * server already cleared the session's active organization; the org-scoped query caches are
 * invalidated so nothing from the exited organization lingers. A failed lookup or activation
 * toasts and falls back to `/dashboard`, where the `_org` guard retries it with its own error UI.
 */
export function useOrgLanding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return async function landAfterExit(exitedOrganizationId: string): Promise<void> {
    for (const key of ORG_SCOPED_QUERY_ROOTS) {
      queryClient.removeQueries({ queryKey: [key] });
    }

    const { data: organizations, error: listError } = await authClient.organization.list();
    const decision = decideOrgLanding({ organizations, listError, exitedOrganizationId });

    if (decision.type === "error") {
      toast.error(decision.message);
      await navigate({ to: "/dashboard" });
      return;
    }
    if (decision.type === "onboarding") {
      await navigate({ to: "/onboarding" });
      return;
    }

    const { error } = await authClient.organization.setActive({
      organizationId: decision.organizationId,
    });
    if (error) {
      toast.error(betterAuthErrorMessage(error, "Could not switch to your next organization."));
    }
    await navigate({ to: "/dashboard" });
  };
}
