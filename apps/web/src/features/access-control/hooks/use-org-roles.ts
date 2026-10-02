import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/app/auth-client";

export type OrgRoleRow = {
  id: string;
  organizationId: string;
  role: string;
  permission: Record<string, string[]>;
  createdAt: string | Date;
};

/** The active organization's custom roles (R4), keyed by organization. Built-ins are code-defined; combine with `buildRoleCatalog`. */
export function useOrgRoles(activeOrganizationId: string | undefined) {
  return useQuery({
    queryKey: ["org-roles", activeOrganizationId],
    queryFn: async () => {
      const { data, error } = await authClient.organization.listRoles({ query: {} });
      if (error) {
        throw error;
      }
      return data as OrgRoleRow[];
    },
    enabled: Boolean(activeOrganizationId),
    staleTime: 30_000,
  });
}
