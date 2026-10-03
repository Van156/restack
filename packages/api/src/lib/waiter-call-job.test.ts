import { describe, expect, test } from "bun:test";

import type { DbExecutor } from "./executor";
import { startWaiterCallJob } from "./waiter-call-job";

const deps = { db: {} as DbExecutor, clock: { now: () => new Date() } };

function fakeScheduler() {
  let tick: (() => void) | undefined;
  let cleared = false;
  return {
    scheduler: {
      setInterval: (callback: () => void) => {
        tick = callback;
        return {};
      },
      clearInterval: () => {
        cleared = true;
      },
    },
    fire: () => tick?.(),
    wasCleared: () => cleared,
  };
}

describe("startWaiterCallJob", () => {
  test("closes once immediately and on every interval until stopped", async () => {
    const timer = fakeScheduler();
    let runs = 0;
    const job = startWaiterCallJob(deps, {
      scheduler: timer.scheduler,
      close: async () => {
        runs += 1;
        return 0;
      },
    });
    await job.idle();
    timer.fire();
    await job.idle();
    expect(runs).toBe(2);
    job.stop();
    expect(timer.wasCleared()).toBe(true);
  });

  test("a failed run is reported and the schedule continues", async () => {
    const timer = fakeScheduler();
    const errors: unknown[] = [];
    let runs = 0;
    const job = startWaiterCallJob(deps, {
      scheduler: timer.scheduler,
      onError: (error) => errors.push(error),
      close: async () => {
        runs += 1;
        throw new Error("db down");
      },
    });
    await job.idle();
    timer.fire();
    await job.idle();
    expect(errors).toHaveLength(2);
    expect(runs).toBe(2);
  });

  test("a tick that fires while a run is in flight is skipped", async () => {
    const timer = fakeScheduler();
    let release: () => void = () => {};
    let runs = 0;
    let skipped = 0;
    const job = startWaiterCallJob(deps, {
      scheduler: timer.scheduler,
      onSkippedTick: () => (skipped += 1),
      close: () => {
        runs += 1;
        return new Promise<number>((resolve) => {
          release = () => resolve(0);
        });
      },
    });
    timer.fire();
    expect(skipped).toBe(1);
    release();
    await job.idle();
    expect(runs).toBe(1);
  });
});
