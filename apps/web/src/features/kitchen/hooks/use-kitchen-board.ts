import { useMemo, useRef, useState } from "react";

import { useFeed } from "@/shared/hooks/use-feed";
import { useRuntime } from "@/shared/hooks/use-runtime";
import { createPollingTransport } from "@/shared/lib/polling";

import { describeAdvanceError } from "../lib/advance-error";
import {
  applyAdvances,
  boardMetrics,
  groupBoard,
  type BoardTicket,
  type TicketStatus,
} from "../lib/board";
import { isDeviceRejected, offlineStatus } from "../lib/device-session";

export const KITCHEN_POLL_INTERVAL_MS = 1000;

/** Where the board reads and moves Tickets: a Paired device client or a Staff session client. */
export type KitchenSource = {
  list: () => Promise<BoardTicket[]>;
  advance: (ticketId: string, status: Exclude<TicketStatus, "nuevo">) => Promise<unknown>;
};

/**
 * Polls the Tickets every second and exposes the grouped board. A failed poll opens an outage
 * (the last board stays); the server refusing the credential is reported through `onRejected`.
 * `source` must be stable.
 */
export function useKitchenBoard(source: KitchenSource, onRejected?: () => void) {
  const { clock, timer } = useRuntime();
  const [offlineSince, setOfflineSince] = useState<Date | null>(null);
  const [advanced, setAdvanced] = useState<Record<string, TicketStatus>>({});
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const inFlight = useRef(new Set<string>());

  const transport = useMemo(
    () =>
      createPollingTransport({
        fetch: source.list,
        intervalMs: KITCHEN_POLL_INTERVAL_MS,
        timer,
        clock,
      }),
    [source, timer, clock],
  );
  const feed = useFeed(transport, {
    onData: () => setOfflineSince(null),
    onError: (error) => {
      if (isDeviceRejected(error)) {
        onRejected?.();
        return;
      }
      setOfflineSince((since) => since ?? clock.now());
    },
  });

  const now = clock.now();
  const sincePollMs = feed.receivedAt ? Math.max(0, now.getTime() - feed.receivedAt.getTime()) : 0;
  const tickets = useMemo(
    () => (feed.data ? applyAdvances(feed.data, advanced) : undefined),
    [feed.data, advanced],
  );
  const columns = tickets ? groupBoard(tickets, sincePollMs) : [];
  const metrics = boardMetrics(tickets ?? [], sincePollMs);

  async function advance(ticketId: string, status: Exclude<TicketStatus, "nuevo">) {
    if (inFlight.current.has(ticketId)) {
      return;
    }
    inFlight.current.add(ticketId);
    setAdvanceError(null);
    try {
      await source.advance(ticketId, status);
      setAdvanced((previous) => ({ ...previous, [ticketId]: status }));
    } catch (error) {
      if (isDeviceRejected(error)) {
        onRejected?.();
      } else {
        setAdvanceError(describeAdvanceError(error));
      }
    } finally {
      inFlight.current.delete(ticketId);
    }
  }

  return {
    loaded: tickets !== undefined,
    failedToLoad: tickets === undefined && feed.error !== undefined,
    columns,
    metrics,
    connection: offlineStatus(offlineSince, now),
    advanceError,
    advance,
  };
}
