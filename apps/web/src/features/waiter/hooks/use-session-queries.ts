import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { useCached } from "@/shared/hooks/use-cached";

import type { CachedDetail } from "../lib/offline-cache";
import { toMenuView } from "../lib/menu-view";
import { waiterQueryKey } from "./use-floor-queries";
import { useWaiterCache } from "./use-waiter-cache";

export const SESSION_REFETCH_MS = 1000;

/** Menu of a Location as the Waiter sees it: sold-out flag, never the cost. Kept for offline use. */
export function useMenu(locationId: string) {
  const { data: organization } = authClient.useActiveOrganization();
  const cache = useWaiterCache(locationId);
  const query = useQuery({
    queryKey: waiterQueryKey(organization?.id, "menu", locationId),
    queryFn: async () => toMenuView(await client.restaurant.menu.list({ locationId })),
    enabled: Boolean(organization?.id),
  });
  const data = useCached(
    query.data,
    () => cache.read("menu"),
    (value) => cache.write("menu", value),
  );
  return { data, isPending: query.isPending && !data, refetch: () => void query.refetch() };
}

/** One Table session with its lines, refreshed every second like the floor plan. Kept for offline use. */
export function useSessionDetail(locationId: string, sessionId: string | null) {
  const { data: organization } = authClient.useActiveOrganization();
  const cache = useWaiterCache(locationId);
  const query = useQuery({
    queryKey: waiterQueryKey(organization?.id, "session", sessionId),
    queryFn: async (): Promise<CachedDetail> => {
      const { session, lines } = await client.restaurant.orders.getSession({
        tableSessionId: sessionId!,
      });
      return {
        status: session.status,
        lines: lines.map((line) => ({
          id: line.id,
          idempotencyKey: line.idempotencyKey,
          itemName: line.itemName,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          modifiers: line.modifiers,
          note: line.note,
          voided: line.voided,
          ticketId: line.ticketId,
        })),
      };
    },
    enabled: Boolean(organization?.id) && sessionId !== null,
    refetchInterval: SESSION_REFETCH_MS,
    retry: false,
  });
  const data = useCached(
    query.data,
    () => (sessionId ? cache.readDetail(sessionId) : undefined),
    (value) => (sessionId ? cache.writeDetail(sessionId, value) : undefined),
  );
  return {
    data,
    isPending: sessionId !== null && query.isPending && !data,
    refetch: () => void query.refetch(),
  };
}
