import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { betterAuthErrorMessage } from "@/features/auth";
import { MEMBERS_QUERY_ROOT } from "../lib/members-query";
import { ORG_SCOPED_QUERY_ROOTS } from "../lib/org-query-keys";

/** Role-change and remove mutations for the members page. */
export function useMemberMutations() {
  const queryClient = useQueryClient();

  const invalidateAfterRoleChange = () => {
    // The change may touch the caller's own role: refresh both useCan-backing queries as well.
    for (const root of ORG_SCOPED_QUERY_ROOTS) {
      queryClient.invalidateQueries({ queryKey: [root] });
    }
  };

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const { error } = await authClient.organization.updateMemberRole({ memberId, role });
      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Member role updated");
      invalidateAfterRoleChange();
    },
    onError: (error) => {
      toast.error(betterAuthErrorMessage(error, "Could not update the member's role."));
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await authClient.organization.removeMember({ memberIdOrEmail: memberId });
      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: [MEMBERS_QUERY_ROOT] });
    },
    onError: (error) => {
      toast.error(betterAuthErrorMessage(error, "Could not remove the member."));
    },
  });

  return { updateRoleMutation, removeMemberMutation };
}
