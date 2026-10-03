import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { orgQueryKey } from "@/shared/lib/org-query-key";

export function locationsQueryKey(organizationId: string | undefined) {
  return orgQueryKey(organizationId, "locations");
}

/** Locations the caller may act in: all for the Owner, assigned ones for everyone else. */
export function useLocations() {
  const { data: organization } = authClient.useActiveOrganization();
  const organizationId = organization?.id;
  return useQuery({
    queryKey: locationsQueryKey(organizationId),
    queryFn: () => client.restaurant.locations.list(),
    enabled: Boolean(organizationId),
  });
}
