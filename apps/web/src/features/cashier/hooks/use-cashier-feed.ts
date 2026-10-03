import { useMemo } from "react";

import { client } from "@/app/orpc";
import { isNetworkFailure, useOfflineQueue } from "@/features/offline-queue";
import { useCached } from "@/shared/hooks/use-cached";
import { useFeed } from "@/shared/hooks/use-feed";
import { useRuntime } from "@/shared/hooks/use-runtime";
import { createPollingTransport } from "@/shared/lib/polling";

import type { OpenSession } from "../lib/checkout-rows";
import { useCashierCache } from "./use-cashier-cache";

export const CASHIER_POLL_INTERVAL_MS = 1000;

/**
 * Open sessions of a Location, polled once per second. Every round is also the connectivity
 * probe; the last list is kept for offline use.
 */
export function useCashierFeed(locationId: string) {
  const { clock, timer } = useRuntime();
  const { reportRequest } = useOfflineQueue();
  const cache = useCashierCache(locationId);
  const transport = useMemo(
    () =>
      createPollingTransport<OpenSession[]>({
        fetch: async () =>
          (await client.restaurant.orders.listOpenSessions({ locationId })).map((session) => ({
            id: session.id,
            tableId: session.tableId,
            status: session.status,
            openedAt: session.openedAt.toISOString(),
          })),
        intervalMs: CASHIER_POLL_INTERVAL_MS,
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
    feed.data,
    () => cache.readSessions(),
    (value) => cache.writeSessions(value),
  );
  return { sessions, error: feed.error };
}
