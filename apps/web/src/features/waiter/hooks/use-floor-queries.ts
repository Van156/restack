import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { orgQueryKey } from "@/shared/lib/org-query-key";

export function waiterQueryKey(organizationId: string | undefined, ...parts: readonly unknown[]) {
  return orgQueryKey(organizationId, "waiter", ...parts);
}

/** Areas and Tables of a Location: the floor plan itself, which changes rarely. */
export function useFloorLayout(locationId: string) {
  const { data: organization } = authClient.useActiveOrganization();
  const enabled = Boolean(organization?.id);
  const areas = useQuery({
    queryKey: waiterQueryKey(organization?.id, "areas", locationId),
    queryFn: () => client.restaurant.areas.list({ locationId }),
    enabled,
  });
  const tables = useQuery({
    queryKey: waiterQueryKey(organization?.id, "tables", locationId),
    queryFn: () => client.restaurant.tables.list({ locationId }),
    enabled,
  });
  return { areas, tables };
}
