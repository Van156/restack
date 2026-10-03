import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from "react";

import { useRuntime } from "@/shared/hooks/use-runtime";

import { connectivityReducer, initialConnectivity, isOnline } from "../lib/connectivity";
import { deriveOfflineState } from "../lib/offline-window";
import type { OfflineState } from "../lib/offline-window";
import { openOfflineQueue } from "../lib/queue";
import type { EnqueueInput, OfflineQueue } from "../lib/queue";
import { createLocalStorageAdapter, DEFAULT_STORAGE_KEY } from "../lib/storage";
import type { QueueRecord, SyncTransport } from "../lib/types";

export const SYNC_INTERVAL_MS = 5000;

export type OfflineQueueApi = {
  ready: boolean;
  online: boolean;
  state: OfflineState;
  records: QueueRecord[];
  enqueue: (input: EnqueueInput) => Promise<QueueRecord>;
  attachOverride: (key: string, overrideId: string) => Promise<void>;
  retry: (key: string) => Promise<void>;
  syncNow: () => Promise<void>;
  /** Connectivity evidence from any request: a failed one marks the device offline, a reached server online. */
  reportRequest: (outcome: "ok" | "network_failure") => void;
};

const Context = createContext<OfflineQueueApi | null>(null);

/**
 * Opens the device's offline queue for an organization and keeps it in step with connectivity:
 * browser events and request outcomes feed `online`, a timer pushes due records while online.
 * See docs/architecture/restaurant.md#offline-queue.
 */
export function OfflineQueueProvider({
  organizationId,
  transport,
  children,
}: {
  organizationId: string;
  /** Where records are pushed; the app passes `createSyncTransport(client.restaurant.sync)`. */
  transport: SyncTransport;
  children: ReactNode;
}) {
  const { clock, timer } = useRuntime();
  const [queue, setQueue] = useState<OfflineQueue | null>(null);
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const [connectivity, dispatch] = useReducer(connectivityReducer, undefined, () =>
    initialConnectivity(typeof navigator === "undefined" || navigator.onLine),
  );
  const online = isOnline(connectivity);

  useEffect(() => {
    let cancelled = false;
    void openOfflineQueue({
      storage: createLocalStorageAdapter({ key: `${DEFAULT_STORAGE_KEY}:${organizationId}` }),
      clock,
      transport,
    }).then((opened) => {
      if (!cancelled) {
        // An incident left open by the last session stays open until a request proves the server is back.
        if (!opened.offlineState().online) {
          dispatch({ type: "request_failed" });
        }
        setQueue(opened);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId, clock, transport]);

  useEffect(() => {
    const goOnline = () => dispatch({ type: "browser_online" });
    const goOffline = () => dispatch({ type: "browser_offline" });
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!queue) {
      return;
    }
    void (online ? queue.reportOnline() : queue.reportOffline()).then(refresh);
  }, [queue, online]);

  useEffect(() => {
    if (!queue) {
      return;
    }
    const opened = queue;
    let stopped = false;
    let cancel = () => {};
    async function tick() {
      if (online && opened.selectBatch().length > 0) {
        await opened.sync();
        if (opened.list().every((record) => record.status === "synced")) {
          await opened.purgeSynced();
        }
      }
      if (!stopped) {
        refresh();
        cancel = timer.setTimeout(() => void tick(), SYNC_INTERVAL_MS);
      }
    }
    void tick();
    return () => {
      stopped = true;
      cancel();
    };
  }, [queue, online, timer]);

  /** Runs `work` on the opened queue and re-renders with the result; rejects while it is still opening. */
  const withQueue = async <T,>(work: (opened: OfflineQueue) => Promise<T>): Promise<T> => {
    if (!queue) {
      throw new Error("The offline queue is still opening.");
    }
    const result = await work(queue);
    refresh();
    return result;
  };
  // Rebuilt on every render so `records` and `state` always read the queue as it is now.
  const api: OfflineQueueApi = {
    ready: queue !== null,
    online,
    state: queue ? queue.offlineState() : deriveOfflineState(null, clock.now()),
    records: queue ? queue.list() : [],
    enqueue: (input) => withQueue((opened) => opened.enqueue(input)),
    attachOverride: (key, overrideId) =>
      withQueue((opened) => opened.attachOverride(key, overrideId)),
    retry: (key) => withQueue((opened) => opened.retry(key)),
    syncNow: async () => {
      if (queue) {
        await withQueue((opened) => opened.sync());
      }
    },
    reportRequest: (outcome) =>
      dispatch({ type: outcome === "ok" ? "request_succeeded" : "request_failed" }),
  };
  return <Context.Provider value={api}>{children}</Context.Provider>;
}

/** The device's offline queue and connectivity; needs an `OfflineQueueProvider` above. */
export function useOfflineQueue(): OfflineQueueApi {
  const context = useContext(Context);
  if (!context) {
    throw new Error("useOfflineQueue needs an OfflineQueueProvider.");
  }
  return context;
}
