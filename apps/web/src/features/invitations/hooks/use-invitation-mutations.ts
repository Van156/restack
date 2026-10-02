import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { betterAuthErrorMessage } from "@/features/auth";

import type { InvitationRow } from "../types";

/** Invite, resend and cancel mutations; each refreshes the pending-invitations list. */
export function useInvitationMutations() {
  const queryClient = useQueryClient();
  const invalidateInvitations = () =>
    queryClient.invalidateQueries({ queryKey: ["org-invitations"] });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const { error } = await authClient.organization.inviteMember({ email, role });
      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Invitation sent");
      invalidateInvitations();
    },
    onError: (error) => {
      toast.error(betterAuthErrorMessage(error, "Could not send the invitation."));
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (invitation: InvitationRow) => {
      const { error } = await authClient.organization.inviteMember({
        email: invitation.email,
        role: invitation.role,
        resend: true,
      });
      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Invitation resent");
      invalidateInvitations();
    },
    onError: (error) => {
      toast.error(betterAuthErrorMessage(error, "Could not resend the invitation."));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await authClient.organization.cancelInvitation({ invitationId });
      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Invitation cancelled");
      invalidateInvitations();
    },
    onError: (error) => {
      toast.error(betterAuthErrorMessage(error, "Could not cancel the invitation."));
    },
  });

  return { inviteMutation, resendMutation, cancelMutation };
}
