import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { betterAuthErrorMessage } from "@/features/auth";

import { ACTIVE_MEMBER_ROLE_QUERY_ROOT, CAN_QUERY_ROOT } from "../lib/query-keys";
import type { PermissionsRecord } from "../lib/role-catalog";

/** Create, update and delete mutations for custom roles; `onSaved` fires after a create or update succeeds. */
export function useRoleMutations({ onSaved }: { onSaved: () => void }) {
  const queryClient = useQueryClient();

  const invalidateAfterRoleWrite = () => {
    queryClient.invalidateQueries({ queryKey: ["org-roles"] });
    // A role's permissions changed, so anyone holding it (the caller included) may resolve differently.
    queryClient.invalidateQueries({ queryKey: [CAN_QUERY_ROOT] });
    queryClient.invalidateQueries({ queryKey: [ACTIVE_MEMBER_ROLE_QUERY_ROOT] });
  };

  const createMutation = useMutation({
    mutationFn: async (input: { role: string; permission: PermissionsRecord }) => {
      const { error } = await authClient.organization.createRole(input);
      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Role created");
      onSaved();
      invalidateAfterRoleWrite();
    },
    onError: (error) => {
      toast.error(betterAuthErrorMessage(error, "Could not create the role."));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: { roleName: string; permission: PermissionsRecord }) => {
      const { error } = await authClient.organization.updateRole({
        roleName: input.roleName,
        data: { permission: input.permission },
      });
      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Role updated");
      onSaved();
      invalidateAfterRoleWrite();
    },
    onError: (error) => {
      toast.error(betterAuthErrorMessage(error, "Could not update the role."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (roleName: string) => {
      const { error } = await authClient.organization.deleteRole({ roleName });
      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Role deleted");
      invalidateAfterRoleWrite();
    },
    onError: (error) => {
      // R4.6: the server's message for a still-assigned role is shown verbatim.
      toast.error(betterAuthErrorMessage(error, "Could not delete the role."));
    },
  });

  return { createMutation, updateMutation, deleteMutation };
}
