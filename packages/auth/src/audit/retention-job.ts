import type { Database } from "@base-template/db";

import { purgeExpiredAuditLog } from "./retention";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Default `maxInFlightMs`: far beyond an ordinary batched purge, short enough that a hung one cannot stop retention forever. */
const DEFAULT_MAX_IN_FLIGHT_MS = 30 * 60 * 1000;

export type AuditRetentionJobHandle = { stop: () => void };

/** Source of "now", injectable so tests can drive the in-flight math without real time. */
export type AuditRetentionClock = { now: () => number };

/** An interval-timer handle as narrowly as this module needs it (only `unref` is ever called on it). */
export type AuditRetentionSchedulerHandle = { unref?: () => void };

/** Timer primitives, injectable so tests can fire a tick on demand. Defaults to the global timers. */
export type AuditRetentionScheduler = {
  setInterval: (callback: () => void, intervalMs: number) => AuditRetentionSchedulerHandle;
  clearInterval: (handle: AuditRetentionSchedulerHandle) => void;
};

const realClock: AuditRetentionClock = { now: () => Date.now() };

// Bare references (not `globalThis.`-qualified): resolved at call time, so a test that
// monkey-patches `globalThis.setInterval`/`clearInterval` still takes effect.
const realScheduler: AuditRetentionScheduler = {
  setInterval: (callback, intervalMs) => setInterval(callback, intervalMs),
  clearInterval: (handle) => clearInterval(handle as unknown as ReturnType<typeof setInterval>),
};

export type StartAuditRetentionJobOptions = {
  /** How often to purge. Defaults to once a day. */
  intervalMs?: number;
  /** Called when a purge rejects or a hung purge is force-released; the schedule keeps running. */
  onError?: (error: unknown) => void;
  /** Called when a tick is skipped because the previous purge is still in flight. */
  onSkippedTick?: (details: { inFlightMs: number }) => void;
  /** Longest a purge may stay in flight before it counts as hung: the latch is released and `onError` is called. */
  maxInFlightMs?: number;
  /** Injectable for tests; defaults to the real {@link purgeExpiredAuditLog}. */
  purge?: typeof purgeExpiredAuditLog;
  /** Injectable for deterministic tests; defaults to the real system clock. */
  clock?: AuditRetentionClock;
  /** Injectable for deterministic tests; defaults to the real global timers. */
  scheduler?: AuditRetentionScheduler;
};

/**
 * Starts the R7.6 retention job: purges once immediately, then every `intervalMs` until `stop()`.
 * Returns `null` (nothing runs) when `retentionDays` is unset or not positive: keep forever.
 * Replicas each run their own timer; batched deletes are idempotent, so overlap is harmless.
 * See docs/architecture/audit-log.md#retention.
 */
export function startAuditRetentionJob(
  db: Database,
  retentionDays: number | null | undefined,
  options: StartAuditRetentionJobOptions = {},
): AuditRetentionJobHandle | null {
  if (!retentionDays || retentionDays <= 0) {
    return null;
  }

  const {
    intervalMs = MS_PER_DAY,
    onError = (error: unknown) => console.error("[audit] retention job failed", error),
    onSkippedTick = (details: { inFlightMs: number }) =>
      console.warn("[audit] retention tick skipped: a purge is still in flight", details),
    maxInFlightMs = DEFAULT_MAX_IN_FLIGHT_MS,
    purge = purgeExpiredAuditLog,
    clock = realClock,
    scheduler = realScheduler,
  } = options;

  // `purging` stops overlapping purges within this process. `generation` keeps a force-released
  // purge's late completion from clearing the latch of a newer one.
  let purging = false;
  let purgeStartedAt = 0;
  let generation = 0;
  const run = () => {
    if (purging) {
      const inFlightMs = clock.now() - purgeStartedAt;
      if (inFlightMs < maxInFlightMs) {
        onSkippedTick({ inFlightMs });
        return;
      }
      // Hung purge: the stuck promise cannot be cancelled, so stop waiting on it and start afresh.
      onError(
        new Error(
          `[audit] retention purge exceeded maxInFlightMs (${maxInFlightMs}ms); releasing the in-flight latch so the schedule can continue`,
        ),
      );
    }
    const myGeneration = ++generation;
    purging = true;
    purgeStartedAt = clock.now();
    purge(db, retentionDays)
      .catch(onError)
      .finally(() => {
        if (generation === myGeneration) {
          purging = false;
        }
      });
  };

  run();
  const interval = scheduler.setInterval(run, intervalMs);
  // Never keeps the process alive on its own, so a short-lived script can still exit.
  interval.unref?.();
  return {
    stop: () => scheduler.clearInterval(interval),
  };
}
