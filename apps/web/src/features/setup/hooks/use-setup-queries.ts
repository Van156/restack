import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { orgQueryKey } from "@/shared/lib/org-query-key";

/** Prefix of every setup query of the organization; one invalidation refreshes the wizard. */
export function setupQueryKey(organizationId: string | undefined, ...parts: readonly unknown[]) {
  return orgQueryKey(organizationId, "setup", ...parts);
}

function useSetupQuery<T>(parts: readonly unknown[], queryFn: () => Promise<T>, enabled = true) {
  const { data: organization } = authClient.useActiveOrganization();
  return useQuery({
    queryKey: setupQueryKey(organization?.id, ...parts),
    queryFn,
    enabled: Boolean(organization?.id) && enabled,
  });
}

export const useAreas = (locationId: string) =>
  useSetupQuery(["areas", locationId], () => client.restaurant.areas.list({ locationId }));

export const useTables = (locationId: string) =>
  useSetupQuery(["tables", locationId], () => client.restaurant.tables.list({ locationId }));

export const useStations = (locationId: string) =>
  useSetupQuery(["stations", locationId], () => client.restaurant.stations.list({ locationId }));

export const useCategories = () =>
  useSetupQuery(["categories"], () => client.restaurant.menu.categories.list());

export const useMenuItems = () =>
  useSetupQuery(["items"], () => client.restaurant.menu.items.list());

export const useLocationMenu = (locationId: string) =>
  useSetupQuery(["location-menu", locationId], () => client.restaurant.menu.list({ locationId }));

export const useSetupReview = (locationId: string) =>
  useSetupQuery(["review", locationId], () => client.restaurant.setup.review({ locationId }));
