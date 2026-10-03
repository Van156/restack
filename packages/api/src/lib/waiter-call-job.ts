import type { Clock } from "../context";
import type { DbExecutor } from "./executor";
import type { OutboxJobScheduler } from "./invoicing/outbox-job";
import { closeSettledSessionCalls } from "./waiter-call-close";

const DEFAULT_INTERVAL_MS = 30 * 1000;

export type WaiterCallJobDeps = { db: DbExecutor; clock: Clock };

export type WaiterCallJobOptions = {
  intervalMs?: number;
  onError?: (error: unknown) => void;
  onSkippedTick?: () => void;
  /** Injectable for tests; defaults to {@link closeSettledSessionCalls}. */
  close?: (db: DbExecutor, clock: Clock) => Promise<number>;
  scheduler?: OutboxJobScheduler;
};

const realScheduler: OutboxJobScheduler = {
  setInterval: (callback, intervalMs) => setInterval(callback, intervalMs),
  // The scheduler type hides the timer handle's runtime type (Node and DOM typings differ).
  clearInterval: (handle) => clearInterval(handle as unknown as ReturnType<typeof setInterval>),
};

/**
 * Attends the calls of settled Table sessions now and then every interval until `stop()`: the
 * fallback for the settle path. Overlapping ticks are skipped; a failed run keeps the schedule.
 */
export function startWaiterCallJob(deps: WaiterCallJobDeps, options: WaiterCallJobOptions = {}) {
  const {
    intervalMs = DEFAULT_INTERVAL_MS,
    onError = (error: unknown) => console.error("[waiter-call] close failed", error),
    onSkippedTick = () => console.warn("[waiter-call] tick skipped: a run is still going"),
    close = closeSettledSessionCalls,
    scheduler = realScheduler,
  } = options;

  let running: Promise<void> | null = null;
  const run = () => {
    if (running) {
      onSkippedTick();
      return;
    }
    running = close(deps.db, deps.clock)
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
    /** Resolves when the run in flight, if any, has finished. */
    idle: async () => {
      await running;
    },
  };
}
