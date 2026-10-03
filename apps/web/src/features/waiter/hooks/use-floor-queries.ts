import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { useCached } from "@/shared/hooks/use-cached";
import { orgQueryKey } from "@/shared/lib/org-query-key";

import { useWaiterCache } from "./use-waiter-cache";

export function waiterQueryKey(organizationId: string | undefined, ...parts: readonly unknown[]) {
  return orgQueryKey(organizationId, "waiter", ...parts);
}

/** Areas and Tables of a Location: the floor plan itself, which changes rarely. Kept for offline use. */
export function useFloorLayout(locationId: string) {
  const { data: organization } = authClient.useActiveOrganization();
  const enabled = Boolean(organization?.id);
  const cache = useWaiterCache(locationId);
  const areas = useQuery({
    queryKey: waiterQueryKey(organization?.id, "areas", locationId),
    queryFn: async () =>
      (await client.restaurant.areas.list({ locationId })).map(({ id, name }) => ({ id, name })),
    enabled,
  });
  const tables = useQuery({
    queryKey: waiterQueryKey(organization?.id, "tables", locationId),
    queryFn: async () =>
      (await client.restaurant.tables.list({ locationId })).map(({ id, areaId, name, seats }) => ({
        id,
        areaId,
        name,
        seats,
      })),
    enabled,
  });
  const areaData = useCached(
    areas.data,
    () => cache.read("areas"),
    (value) => cache.write("areas", value),
  );
  const tableData = useCached(
    tables.data,
    () => cache.read("tables"),
    (value) => cache.write("tables", value),
  );
  return {
    areas: areaData,
    tables: tableData,
    isPending: (areas.isPending && !areaData) || (tables.isPending && !tableData),
    refetch: () => {
      void areas.refetch();
      void tables.refetch();
    },
  };
}
