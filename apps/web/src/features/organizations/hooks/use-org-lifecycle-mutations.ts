import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { client } from "@/app/orpc";
import { transferOwnershipErrorMessage } from "../lib/org-danger-zone";
import { ORG_SCOPED_QUERY_ROOTS } from "../lib/org-query-keys";
import { useOrgExitMutation } from "./use-org-exit-mutation";

/**
 * Transfer-ownership, leave and delete mutations for the General page danger zone (R8.4, R10, R11).
 * `leaveMutation` and `deleteMutation` take the organization id as their variable.
 */
export function useOrgLifecycleMutations({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();

  const transferMutation = useMutation({
    mutationFn: (targetMemberId: string) =>
      client.organization.transferOwnership({ organizationId, targetMemberId }),
    onSuccess: () => {
      toast.success("Ownership transferred. You are now an admin.");
    },
    onError: (error) => {
      toast.error(transferOwnershipErrorMessage(error));
    },
    // A failed call may still have changed roles (the audit write runs after the commit), so the
    // caller's role and permission queries refresh on error too.
    onSettled: () => {
      for (const root of ORG_SCOPED_QUERY_ROOTS) {
        queryClient.invalidateQueries({ queryKey: [root] });
      }
    },
  });

  const leaveMutation = useOrgExitMutation("leave");
  const deleteMutation = useOrgExitMutation("delete");

  return { transferMutation, leaveMutation, deleteMutation };
}
