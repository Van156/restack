import { drainOutbox } from "./transmit";
import type { DrainSummary, InvoicingDeps } from "./transmit";

const DEFAULT_INTERVAL_MS = 60 * 1000;

export type OutboxJobScheduler = {
  setInterval: (callback: () => void, intervalMs: number) => { unref?: () => void };
  clearInterval: (handle: { unref?: () => void }) => void;
};

export type OutboxJobOptions = {
  intervalMs?: number;
  onError?: (error: unknown) => void;
  onSkippedTick?: () => void;
  /** Injectable for tests; defaults to {@link drainOutbox}. */
  drain?: (deps: InvoicingDeps) => Promise<DrainSummary>;
  /** Injectable for tests; defaults to the global timers. */
  scheduler?: OutboxJobScheduler;
};

export type OutboxJobHandle = {
  stop: () => void;
  /** Resolves when the drain in flight, if any, has finished. */
  idle: () => Promise<void>;
};

const realScheduler: OutboxJobScheduler = {
  setInterval: (callback, intervalMs) => setInterval(callback, intervalMs),
  // The scheduler type hides the timer handle's runtime type (Node and DOM typings differ).
  clearInterval: (handle) => clearInterval(handle as unknown as ReturnType<typeof setInterval>),
};

/**
 * Drains the DIAN outbox once now and then every interval until `stop()`. Overlapping ticks are
 * skipped; a failed drain is reported and the schedule continues.
 * See docs/architecture/restaurant.md#outbox-and-incidents.
 */
export function startInvoicingOutboxJob(
  deps: InvoicingDeps,
  options: OutboxJobOptions = {},
): OutboxJobHandle {
  const {
    intervalMs = DEFAULT_INTERVAL_MS,
    onError = (error: unknown) => console.error("[dian] outbox drain failed", error),
    onSkippedTick = () => console.warn("[dian] outbox tick skipped: a drain is still running"),
    drain = drainOutbox,
    scheduler = realScheduler,
  } = options;

  let running: Promise<void> | null = null;
  const run = () => {
    if (running) {
      onSkippedTick();
      return;
    }
    running = drain(deps)
      .then(() => undefined)
      .catch(onError)
      .finally(() => {
        running = null;
      });
  };

  run();
  const interval = scheduler.setInterval(run, intervalMs);
  interval.unref?.();
  return {
    stop: () => scheduler.clearInterval(interval),
    idle: async () => {
      await running;
    },
  };
}
