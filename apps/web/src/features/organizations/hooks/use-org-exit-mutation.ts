import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { betterAuthErrorMessage } from "@/features/auth";
import { orgExitCopy, type OrgExit } from "../lib/org-exit";
import { useOrgLanding } from "./use-org-landing";

/**
 * Leave or delete an organization, then land the user elsewhere. The server call is the mutation:
 * once it succeeds the exit is reported as done, and a failure of the landing step afterwards is
 * reported separately so a completed exit never reads as a failed one.
 */
export function useOrgExitMutation(exit: OrgExit) {
  const landAfterExit = useOrgLanding();
  const copy = orgExitCopy(exit);

  return useMutation({
    mutationFn: async (organizationId: string) => {
      const { error } =
        exit === "leave"
          ? await authClient.organization.leave({ organizationId })
          : await authClient.organization.delete({ organizationId });
      if (error) {
        throw error;
      }
      return organizationId;
    },
    onSuccess: async (organizationId) => {
      toast.success(copy.success);
      try {
        await landAfterExit(organizationId);
      } catch {
        toast.error(copy.landingFailure);
      }
    },
    onError: (error) => {
      toast.error(betterAuthErrorMessage(error, copy.failure));
    },
  });
}
