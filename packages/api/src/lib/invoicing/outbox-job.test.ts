import { describe, expect, test } from "bun:test";

import { startInvoicingOutboxJob } from "./outbox-job";
import type { DrainSummary, InvoicingDeps } from "./transmit";

const summary: DrainSummary = { attempted: 0, issued: 0, rejected: 0, stillPending: 0, overdue: 0 };
const deps = {} as InvoicingDeps;

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

describe("startInvoicingOutboxJob", () => {
  test("drains once immediately and on every interval until stopped", async () => {
    const timer = fakeScheduler();
    let drains = 0;
    const job = startInvoicingOutboxJob(deps, {
      scheduler: timer.scheduler,
      drain: async () => {
        drains += 1;
        return summary;
      },
    });
    await job.idle();
    expect(drains).toBe(1);
    timer.fire();
    await job.idle();
    expect(drains).toBe(2);
    job.stop();
    expect(timer.wasCleared()).toBe(true);
  });

  test("a tick that fires while a drain is running is skipped", async () => {
    const timer = fakeScheduler();
    let release: () => void = () => {};
    let drains = 0;
    let skipped = 0;
    const job = startInvoicingOutboxJob(deps, {
      scheduler: timer.scheduler,
      onSkippedTick: () => {
        skipped += 1;
      },
      drain: () => {
        drains += 1;
        return new Promise<DrainSummary>((resolve) => {
          release = () => resolve(summary);
        });
      },
    });
    timer.fire();
    expect(skipped).toBe(1);
    expect(drains).toBe(1);
    release();
    await job.idle();
    timer.fire();
    expect(drains).toBe(2);
    release();
    await job.idle();
  });

  test("a failing drain is reported and the schedule keeps running", async () => {
    const timer = fakeScheduler();
    const errors: unknown[] = [];
    let drains = 0;
    const job = startInvoicingOutboxJob(deps, {
      scheduler: timer.scheduler,
      onError: (error) => errors.push(error),
      drain: async () => {
        drains += 1;
        if (drains === 1) {
          throw new Error("boom");
        }
        return summary;
      },
    });
    await job.idle();
    expect(errors).toHaveLength(1);
    timer.fire();
    await job.idle();
    expect(drains).toBe(2);
  });
});
