import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";

import { waiterQueryKey } from "./use-floor-queries";

export const SESSION_REFETCH_MS = 1000;

/** Menu of a Location as the Waiter sees it: sold-out flag and Station, never the cost. */
export function useMenu(locationId: string) {
  const { data: organization } = authClient.useActiveOrganization();
  return useQuery({
    queryKey: waiterQueryKey(organization?.id, "menu", locationId),
    queryFn: () => client.restaurant.menu.list({ locationId }),
    enabled: Boolean(organization?.id),
  });
}

/** One Table session with its lines, refreshed every second like the floor plan. */
export function useSessionDetail(sessionId: string | null) {
  const { data: organization } = authClient.useActiveOrganization();
  return useQuery({
    queryKey: waiterQueryKey(organization?.id, "session", sessionId),
    queryFn: () => client.restaurant.orders.getSession({ tableSessionId: sessionId! }),
    enabled: Boolean(organization?.id) && sessionId !== null,
    refetchInterval: SESSION_REFETCH_MS,
  });
}
