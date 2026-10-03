import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { useCached } from "@/shared/hooks/use-cached";

import type { CheckoutTable } from "../lib/checkout-rows";
import { cashierQueryKey } from "./cashier-query-key";
import { useCashierCache } from "./use-cashier-cache";

/** Table names with their Area, to label the Bills. Kept for offline use. */
export function useCheckoutTables(locationId: string) {
  const { data: organization } = authClient.useActiveOrganization();
  const cache = useCashierCache(locationId);
  const query = useQuery({
    queryKey: cashierQueryKey(organization?.id, "tables", locationId),
    queryFn: async (): Promise<CheckoutTable[]> => {
      const [areas, tables] = await Promise.all([
        client.restaurant.areas.list({ locationId }),
        client.restaurant.tables.list({ locationId }),
      ]);
      const areaName = new Map(areas.map((area) => [area.id, area.name]));
      return tables.map((table) => ({
        id: table.id,
        name: table.name,
        areaName: areaName.get(table.areaId) ?? "",
      }));
    },
    enabled: Boolean(organization?.id),
  });
  return useCached(
    query.data,
    () => cache.readTables(),
    (value) => cache.writeTables(value),
  );
}
