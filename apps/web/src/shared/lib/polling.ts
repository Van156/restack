import type { Clock } from "./clock";

/** Schedules one callback; the returned function cancels it. Injected so tests control time. */
export type Timer = { setTimeout(run: () => void, delayMs: number): () => void };

export const browserTimer: Timer = {
  setTimeout(run, delayMs) {
    const id = globalThis.setTimeout(run, delayMs);
    return () => globalThis.clearTimeout(id);
  },
};

export type PollListener<T> = {
  onData(value: T, receivedAt: Date): void;
  onError(error: unknown): void;
};

/** A live feed of values. Polling is one implementation; a realtime socket could replace it. */
export type FeedTransport<T> = {
  /** Starts delivering values to `listener`; the returned function stops it. */
  subscribe(listener: PollListener<T>): () => void;
};

/**
 * Polls `fetch` once per `intervalMs`, waiting for each round to finish so rounds never overlap.
 * A failed round is reported and polling goes on; stopping drops any round still in flight.
 */
export function createPollingTransport<T>(deps: {
  fetch: () => Promise<T>;
  intervalMs: number;
  timer: Timer;
  clock: Clock;
}): FeedTransport<T> {
  return {
    subscribe(listener) {
      let stopped = false;
      let cancelNext: (() => void) | null = null;

      async function round() {
        try {
          const value = await deps.fetch();
          if (!stopped) {
            listener.onData(value, deps.clock.now());
          }
        } catch (error) {
          if (!stopped) {
            listener.onError(error);
          }
        }
        if (!stopped) {
          cancelNext = deps.timer.setTimeout(() => void round(), deps.intervalMs);
        }
      }

      void round();
      return () => {
        stopped = true;
        cancelNext?.();
      };
    },
  };
}
