import { describe, expect, test } from "bun:test";

import type { Clock } from "./clock";
import { createPollingTransport, type Timer } from "./polling";

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

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createPollingTransport", () => {
  test("fetches at once, then once per interval, stamping each value with the clock", async () => {
    const time = fakeTime(1_000);
    let calls = 0;
    const seen: [number, number][] = [];
    const transport = createPollingTransport({
      fetch: async () => ++calls,
      intervalMs: 1000,
      timer: time.timer,
      clock: time.clock,
    });
    transport.subscribe({
      onData: (value, at) => seen.push([value, at.getTime()]),
      onError: () => {},
    });
    await flush();
    expect(seen).toEqual([[1, 1_000]]);
    time.advance(999);
    await flush();
    expect(calls).toBe(1);
    time.advance(1);
    await flush();
    expect(seen).toEqual([
      [1, 1_000],
      [2, 2_000],
    ]);
  });

  test("keeps polling after a failed round and reports the error", async () => {
    const time = fakeTime();
    const errors: unknown[] = [];
    const values: string[] = [];
    let fail = true;
    createPollingTransport({
      fetch: async () => {
        if (fail) {
          throw new Error("offline");
        }
        return "ok";
      },
      intervalMs: 1000,
      timer: time.timer,
      clock: time.clock,
    }).subscribe({ onData: (value) => values.push(value), onError: (e) => errors.push(e) });
    await flush();
    expect(errors).toHaveLength(1);
    fail = false;
    time.advance(1000);
    await flush();
    expect(values).toEqual(["ok"]);
  });

  test("never overlaps rounds: the next one is scheduled after the current finishes", async () => {
    const time = fakeTime();
    let release: () => void = () => {};
    let calls = 0;
    createPollingTransport({
      fetch: () => {
        calls += 1;
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      },
      intervalMs: 1000,
      timer: time.timer,
      clock: time.clock,
    }).subscribe({ onData: () => {}, onError: () => {} });
    time.advance(5000);
    await flush();
    expect(calls).toBe(1);
    expect(time.hasPending()).toBe(false);
    release();
    await flush();
    expect(time.hasPending()).toBe(true);
  });

  test("stopping cancels the next round and drops a round in flight", async () => {
    const time = fakeTime();
    let release: (value: string) => void = () => {};
    const values: string[] = [];
    const stop = createPollingTransport({
      fetch: () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
      intervalMs: 1000,
      timer: time.timer,
      clock: time.clock,
    }).subscribe({ onData: (value) => values.push(value), onError: () => {} });
    stop();
    release("late");
    await flush();
    expect(values).toEqual([]);
    expect(time.hasPending()).toBe(false);
  });
});
