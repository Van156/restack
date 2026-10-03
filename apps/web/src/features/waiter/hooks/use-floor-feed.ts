import { useMemo } from "react";

import { client } from "@/app/orpc";
import { isNetworkFailure, useOfflineQueue } from "@/features/offline-queue";
import { useFeed } from "@/shared/hooks/use-feed";
import { useRuntime } from "@/shared/hooks/use-runtime";
import { createPollingTransport } from "@/shared/lib/polling";

import type { FloorCall, FloorSession } from "../lib/floor-plan";
import type { WaiterCallInput } from "../lib/waiter-calls";
import { useCached, useWaiterCache } from "./use-waiter-cache";

export const FLOOR_POLL_INTERVAL_MS = 1000;

type FloorFeed = { sessions: FloorSession[]; calls: (FloorCall & WaiterCallInput)[] };

/**
 * Open sessions and Waiter calls of a Location, polled once per second. Every round is also the
 * connectivity probe; the last open sessions are kept for offline use (calls are not).
 */
export function useFloorFeed(locationId: string) {
  const { clock, timer } = useRuntime();
  const { reportRequest } = useOfflineQueue();
  const cache = useWaiterCache(locationId);
  const transport = useMemo(
    () =>
      createPollingTransport<FloorFeed>({
        fetch: async () => {
          const [sessions, calls] = await Promise.all([
            client.restaurant.orders.listOpenSessions({ locationId }),
            client.restaurant.waiterCall.list({ locationId }),
          ]);
          return {
            sessions: sessions.map((session) => ({
              ref: { sessionId: session.id },
              tableId: session.tableId,
              status: session.status,
              hasReadyTicket: session.hasReadyTicket,
            })),
            calls,
          };
        },
        intervalMs: FLOOR_POLL_INTERVAL_MS,
        timer,
        clock,
      }),
    [locationId, clock, timer],
  );
  const feed = useFeed(transport, {
    onData: () => reportRequest("ok"),
    onError: (error) => reportRequest(isNetworkFailure(error) ? "network_failure" : "ok"),
  });
  const sessions = useCached(
    feed.data?.sessions,
    () => cache.read("sessions"),
    (value) => cache.write("sessions", value),
  );
  return { ...feed, sessions, calls: feed.data?.calls ?? [] };
}
