import { parsePermissionString } from "@base-template/auth/permissions";
import { useQuery } from "@tanstack/react-query";

import { useActiveMemberRole } from "./use-active-member-role";
import { authClient } from "@/app/auth-client";
import { deriveCanState } from "../lib/can-state";
import { canQueryKey } from "../lib/query-keys";

/**
 * R5.3: UX-only permission check for the active organization; the server stays the authority.
 * Uses the server's `organization.hasPermission` so custom roles count, cached 60 s (not live).
 * Failures settle to `can: false` with `error`; `refetch` retries both queries.
 * See docs/architecture/authorization.md#usecan-and-useplatformcan.
 */
export function useCan(permission: string): {
  can: boolean;
  isPending: boolean;
  error: unknown;
  refetch: () => void;
} {
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const activeOrganizationId = activeOrganization?.id;

  const activeMemberRole = useActiveMemberRole(activeOrganizationId);

  const canQuery = useQuery({
    queryKey: canQueryKey(activeOrganizationId, activeMemberRole.data, permission),
    queryFn: async () => {
      const { feature, action } = parsePermissionString(permission);
      const { data, error } = await authClient.organization.hasPermission({
        permissions: { [feature]: [action] },
      });
      if (error) {
        throw error;
      }
      return data.success;
    },
    enabled:
      Boolean(activeOrganizationId) &&
      activeMemberRole.data !== undefined &&
      !activeMemberRole.isError,
    staleTime: 60_000,
  });

  return {
    ...deriveCanState({ activeOrganizationId, activeMemberRole, canQuery }),
    refetch: () => {
      activeMemberRole.refetch();
      canQuery.refetch();
    },
  };
}
