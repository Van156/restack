import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { orgQueryKey } from "@/shared/lib/org-query-key";

/** Prefix of the staff queries of the organization. */
export function staffQueryKey(organizationId: string | undefined, ...parts: readonly unknown[]) {
  return orgQueryKey(organizationId, "staff", ...parts);
}

/** Staff with their Location assignments inside the caller's scope (the Owner has no rows). */
export function useStaffAssignments() {
  const { data: organization } = authClient.useActiveOrganization();
  return useQuery({
    queryKey: staffQueryKey(organization?.id, "assignments"),
    queryFn: () => client.restaurant.staff.listAssignments({}),
    enabled: Boolean(organization?.id),
  });
}
