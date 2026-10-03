import { describe, expect, test } from "bun:test";

import type { Clock } from "@/shared/lib/clock";
import type { Timer } from "@/shared/lib/polling";

import { startClockTicks } from "./clock-ticks";

function fakeTime(startMs = 0) {
  let nowMs = startMs;
  let pending: { run: () => void; dueMs: number } | null = null;
  const clock: Clock = { now: () => new Date(nowMs) };
  const timer: Timer = {
    setTimeout(run, delayMs) {
      const entry = { run, dueMs: nowMs + delayMs };
      pending = entry;
      return () => {
        if (pending === entry) {
          pending = null;
        }
      };
    },
  };
  return {
    clock,
    timer,
    hasPending: () => pending !== null,
    advance(ms: number) {
      nowMs += ms;
      if (pending && pending.dueMs <= nowMs) {
        const { run } = pending;
        pending = null;
        run();
      }
    },
  };
}

describe("startClockTicks", () => {
  test("reports the clock at once, then once per interval", () => {
    const time = fakeTime(5_000);
    const seen: number[] = [];
    startClockTicks({
      clock: time.clock,
      timer: time.timer,
      intervalMs: 1000,
      onTick: (now) => seen.push(now.getTime()),
    });
    expect(seen).toEqual([5_000]);
    time.advance(1000);
    time.advance(1000);
    expect(seen).toEqual([5_000, 6_000, 7_000]);
  });

  test("stopping cancels the next tick", () => {
    const time = fakeTime();
    const seen: number[] = [];
    const stop = startClockTicks({
      clock: time.clock,
      timer: time.timer,
      intervalMs: 1000,
      onTick: (now) => seen.push(now.getTime()),
    });
    stop();
    time.advance(1000);
    expect(seen).toEqual([0]);
    expect(time.hasPending()).toBe(false);
  });
});
