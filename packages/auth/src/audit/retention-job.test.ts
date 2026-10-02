import type { Database } from "@base-template/db";
import { afterEach, describe, expect, test } from "bun:test";

import type { AuditRetentionClock, AuditRetentionScheduler } from "./retention-job";
import { startAuditRetentionJob } from "./retention-job";

/** Resolves once every currently-pending microtask (chained `.then`/`.catch`/`.finally`) has run, without waiting on any real timer. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

/**
 * Unit tests for the R7.6 scheduled retention job wiring (T5): given
 * `AUDIT_LOG_RETENTION_DAYS`, purge on a timer; given nothing, do nothing.
 * `purge` is injected (defaults to `purgeExpiredAuditLog`) so these run
 * without a database, exercising only the scheduling behavior.
 */
describe("startAuditRetentionJob (R7.6)", () => {
  let handle: ReturnType<typeof startAuditRetentionJob> = null;

  afterEach(() => {
    handle?.stop();
    handle = null;
  });

  test("returns null and never calls purge when retentionDays is unset (R7.6 default: keep forever)", () => {
    let calls = 0;
    handle = startAuditRetentionJob({} as Database, undefined, {
      purge: async () => {
        calls++;
        return 0;
      },
    });
    expect(handle).toBeNull();
    expect(calls).toBe(0);
  });

  test("returns null and never calls purge when retentionDays is zero or negative", () => {
    let calls = 0;
    const purge = async () => {
      calls++;
      return 0;
    };
    expect(startAuditRetentionJob({} as Database, 0, { purge })).toBeNull();
    expect(startAuditRetentionJob({} as Database, -5, { purge })).toBeNull();
    expect(calls).toBe(0);
  });

  test("runs once immediately, then again on the configured interval, until stopped", async () => {
    let calls = 0;
    handle = startAuditRetentionJob({} as Database, 30, {
      intervalMs: 5,
      purge: async () => {
        calls++;
        return 0;
      },
    });
    expect(handle).not.toBeNull();
    expect(calls).toBe(1); // ran immediately, not just on the first tick

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(calls).toBeGreaterThanOrEqual(2);

    handle?.stop();
    const callsAtStop = calls;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toBe(callsAtStop); // stopped: no further calls
  });

  test("a rejected purge run is reported via onError and does not stop the schedule", async () => {
    const errors: unknown[] = [];
    let calls = 0;
    handle = startAuditRetentionJob({} as Database, 30, {
      intervalMs: 5,
      purge: async () => {
        calls++;
        throw new Error("boom");
      },
      onError: (error) => errors.push(error),
    });

    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  test("skips a tick while the previous purge is still running (T6b)", async () => {
    let concurrentRuns = 0;
    let maxConcurrentRuns = 0;
    let completedRuns = 0;
    handle = startAuditRetentionJob({} as Database, 30, {
      intervalMs: 5,
      purge: async () => {
        concurrentRuns++;
        maxConcurrentRuns = Math.max(maxConcurrentRuns, concurrentRuns);
        // Outlives several 5ms ticks, so without the in-flight guard several
        // would overlap it.
        await new Promise((resolve) => setTimeout(resolve, 30));
        concurrentRuns--;
        completedRuns++;
        return 0;
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(maxConcurrentRuns).toBe(1);
    expect(completedRuns).toBeGreaterThanOrEqual(1);
  });

  test("logs every skipped tick, with the elapsed in-flight time, while a purge is still running (T7a)", async () => {
    const skipped: { inFlightMs: number }[] = [];
    handle = startAuditRetentionJob({} as Database, 30, {
      intervalMs: 5,
      purge: async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return 0;
      },
      onSkippedTick: (details) => skipped.push(details),
    });

    await new Promise((resolve) => setTimeout(resolve, 35));
    expect(skipped.length).toBeGreaterThanOrEqual(1);
    expect(skipped[0]?.inFlightMs).toBeGreaterThanOrEqual(0);
  });

  test("releases a hung purge past maxInFlightMs, reports it via onError, and lets the schedule continue (T7a)", async () => {
    const errors: unknown[] = [];
    let purgeCalls = 0;
    handle = startAuditRetentionJob({} as Database, 30, {
      intervalMs: 5,
      maxInFlightMs: 15,
      purge: async () => {
        purgeCalls++;
        if (purgeCalls === 1) {
          // Simulates a hung purge (e.g. a lost connection with no
          // statement timeout): a promise that never settles.
          return new Promise<number>(() => {});
        }
        return 0;
      },
      onError: (error) => errors.push(error),
    });

    await new Promise((resolve) => setTimeout(resolve, 45));
    expect(purgeCalls).toBeGreaterThanOrEqual(2);
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  test("a late-resolving hung purge does not clear the latch out from under the purge that replaced it (T7a, T8 review follow-up e)", async () => {
    // Deterministic: an injected clock/scheduler replaces the previous
    // version's real-time coordination (real setInterval ticks, plus a 25ms
    // wall-clock sleep sized to outrun `maxInFlightMs`) with values this test
    // drives directly, so the race can never be timing-flaky on a slow
    // runner. `tick` captures the schedule's own `run` callback so the test
    // can fire it on demand instead of waiting for a real timer.
    let currentTime = 0;
    const clock: AuditRetentionClock = { now: () => currentTime };
    let tick: (() => void) | undefined;
    const scheduler: AuditRetentionScheduler = {
      setInterval: (callback) => {
        tick = callback;
        return {};
      },
      clearInterval: () => {},
    };

    let purgeCalls = 0;
    let resolveHung: (() => void) | undefined;
    const replacementResolvers: Array<() => void> = [];
    let concurrentReplacementRuns = 0;
    let maxConcurrentReplacementRuns = 0;

    handle = startAuditRetentionJob({} as Database, 30, {
      intervalMs: 5,
      maxInFlightMs: 20,
      clock,
      scheduler,
      purge: async () => {
        const callNumber = ++purgeCalls;
        if (callNumber === 1) {
          // Hangs until resolved manually below, well after being declared
          // hung by the schedule.
          await new Promise<void>((resolve) => {
            resolveHung = resolve;
          });
          return 0;
        }
        concurrentReplacementRuns++;
        maxConcurrentReplacementRuns = Math.max(
          maxConcurrentReplacementRuns,
          concurrentReplacementRuns,
        );
        await new Promise<void>((resolve) => {
          replacementResolvers.push(resolve);
        });
        concurrentReplacementRuns--;
        return 0;
      },
    });

    // `run()` fires synchronously on start: purge #1 is now in flight.
    expect(purgeCalls).toBe(1);

    // Advance the clock past maxInFlightMs (20ms) and fire a tick: #1 is
    // declared hung, its latch is force-released, and #2 starts.
    currentTime = 25;
    tick?.();
    expect(purgeCalls).toBe(2);

    // Resolve the stale #1 while #2 is still running (not yet resolved).
    // Without per-purge generation tracking, #1's belated `.finally` would
    // clear the shared latch and let a premature #3 start concurrently with
    // #2.
    resolveHung?.();
    await flush();

    // A tick right after #1 resolves must still be a no-op: #2 started its
    // own in-flight window at currentTime=25, so at 26ms it is nowhere near
    // hung. If #1's belated `.finally` had wrongly cleared the shared latch,
    // this tick would start a premature #3.
    currentTime = 26;
    tick?.();
    expect(purgeCalls).toBe(2);
    expect(maxConcurrentReplacementRuns).toBe(1);

    // Let #2 finish legitimately, then the next tick starts #3.
    replacementResolvers[0]?.();
    await flush();
    currentTime = 31;
    tick?.();
    expect(purgeCalls).toBe(3);
    expect(maxConcurrentReplacementRuns).toBe(1);
  });

  test("un-refs its interval timer so it never keeps a short-lived process alive on its own (T6b)", () => {
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;
    let unrefCalls = 0;
    const fakeTimer = {
      unref: () => {
        unrefCalls++;
      },
    };
    globalThis.setInterval = (() => fakeTimer) as unknown as typeof setInterval;
    globalThis.clearInterval = (() => {}) as unknown as typeof clearInterval;
    try {
      const jobHandle = startAuditRetentionJob({} as Database, 30, { purge: async () => 0 });
      jobHandle?.stop();
    } finally {
      globalThis.setInterval = originalSetInterval;
      globalThis.clearInterval = originalClearInterval;
    }
    expect(unrefCalls).toBe(1);
  });
});
