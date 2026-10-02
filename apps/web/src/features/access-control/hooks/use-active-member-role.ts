import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/app/auth-client";

import { activeMemberRoleQueryKey } from "../lib/query-keys";

/** The caller's role string in the active organization (possibly comma-separated), cached 60 s. One query key shared by `useCan` and the settings pages. */
export function useActiveMemberRole(activeOrganizationId: string | undefined) {
  return useQuery({
    queryKey: activeMemberRoleQueryKey(activeOrganizationId),
    queryFn: async () => {
      const { data, error } = await authClient.organization.getActiveMemberRole();
      if (error) {
        throw error;
      }
      return data.role;
    },
    enabled: Boolean(activeOrganizationId),
    staleTime: 60_000,
  });
}
