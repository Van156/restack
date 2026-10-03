import { useMemo } from "react";

import { client } from "@/app/orpc";
import { useFeed } from "@/shared/hooks/use-feed";
import { useRuntime } from "@/shared/hooks/use-runtime";
import { createPollingTransport } from "@/shared/lib/polling";

export const FLOOR_POLL_INTERVAL_MS = 1000;

/** Open sessions and Waiter calls of a Location, polled once per second. */
export function useFloorFeed(locationId: string) {
  const { clock, timer } = useRuntime();
  const transport = useMemo(
    () =>
      createPollingTransport({
        fetch: async () => {
          const [sessions, calls] = await Promise.all([
            client.restaurant.orders.listOpenSessions({ locationId }),
            client.restaurant.waiterCall.list({ locationId }),
          ]);
          return { sessions, calls };
        },
        intervalMs: FLOOR_POLL_INTERVAL_MS,
        timer,
        clock,
      }),
    [locationId, clock, timer],
  );
  return useFeed(transport);
}
