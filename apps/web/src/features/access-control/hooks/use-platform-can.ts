import { parsePermissionString } from "@base-template/auth/permissions";
import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/app/auth-client";

/**
 * UX-only platform permission check (R6): `admin.hasPermission` with no `userId`/`role`, so the
 * server resolves both from the caller's session, never client input (R6.5). `platformProcedure`
 * stays the authority. See docs/architecture/authorization.md#usecan-and-useplatformcan.
 */
export function usePlatformCan(permission: string) {
  return useQuery({
    queryKey: ["platform-can", permission],
    queryFn: async () => {
      const { feature, action } = parsePermissionString(permission);
      const { data, error } = await authClient.admin.hasPermission({
        permissions: { [feature]: [action] },
      });
      if (error) {
        throw error;
      }
      return data.success;
    },
    staleTime: 60_000,
  });
}
