import { describe, expect, test } from "bun:test";

import { memoryStorage } from "./test-support";
import { LOCKOUT_MS, MAX_PIN_ATTEMPTS, createPinThrottle } from "./pin-throttle";

const start = new Date("2026-10-03T12:00:00Z");
const after = (ms: number) => new Date(start.getTime() + ms);

describe("offline PIN throttle", () => {
  test("allows attempts until the fifth wrong PIN, then locks for fifteen minutes", () => {
    expect(MAX_PIN_ATTEMPTS).toBe(5);
    expect(LOCKOUT_MS).toBe(15 * 60 * 1000);
    const throttle = createPinThrottle(memoryStorage(), "k");

    for (let attempt = 1; attempt < MAX_PIN_ATTEMPTS; attempt += 1) {
      expect(throttle.check("m1", start)).toEqual({ locked: false });
      throttle.recordFailure("m1", start);
    }
    expect(throttle.check("m1", start)).toEqual({ locked: false });
    throttle.recordFailure("m1", start);

    expect(throttle.check("m1", after(LOCKOUT_MS - 1))).toEqual({
      locked: true,
      until: after(LOCKOUT_MS),
    });
  });

  test("allows five more attempts once the lockout is over", () => {
    const throttle = createPinThrottle(memoryStorage(), "k");
    for (let attempt = 0; attempt < MAX_PIN_ATTEMPTS; attempt += 1) {
      throttle.recordFailure("m1", start);
    }

    expect(throttle.check("m1", after(LOCKOUT_MS))).toEqual({ locked: false });
    for (let attempt = 1; attempt < MAX_PIN_ATTEMPTS; attempt += 1) {
      throttle.recordFailure("m1", after(LOCKOUT_MS));
    }
    expect(throttle.check("m1", after(LOCKOUT_MS))).toEqual({ locked: false });
  });

  test("a correct PIN clears the failures", () => {
    const throttle = createPinThrottle(memoryStorage(), "k");
    for (let attempt = 1; attempt < MAX_PIN_ATTEMPTS; attempt += 1) {
      throttle.recordFailure("m1", start);
    }
    throttle.recordSuccess("m1");
    throttle.recordFailure("m1", start);

    expect(throttle.check("m1", start)).toEqual({ locked: false });
  });

  test("one member's lockout does not lock the others", () => {
    const throttle = createPinThrottle(memoryStorage(), "k");
    for (let attempt = 0; attempt < MAX_PIN_ATTEMPTS; attempt += 1) {
      throttle.recordFailure("m1", start);
    }

    expect(throttle.check("m1", start).locked).toBe(true);
    expect(throttle.check("m2", start)).toEqual({ locked: false });
  });

  test("persists across reloads, so reloading the page does not reset it", () => {
    const storage = memoryStorage();
    const first = createPinThrottle(storage, "k");
    for (let attempt = 0; attempt < MAX_PIN_ATTEMPTS; attempt += 1) {
      first.recordFailure("m1", start);
    }

    expect(createPinThrottle(storage, "k").check("m1", start).locked).toBe(true);
  });

  test("corrupt stored state counts as no failures", () => {
    const throttle = createPinThrottle(memoryStorage({ k: "[1,2" }), "k");
    expect(throttle.check("m1", start)).toEqual({ locked: false });
  });

  test("counts the tries left, starting over after a lockout", () => {
    const throttle = createPinThrottle(memoryStorage(), "k");
    expect(throttle.attemptsLeft("m1", start)).toBe(MAX_PIN_ATTEMPTS);

    throttle.recordFailure("m1", start);
    throttle.recordFailure("m1", start);
    expect(throttle.attemptsLeft("m1", start)).toBe(MAX_PIN_ATTEMPTS - 2);

    for (let attempt = 2; attempt < MAX_PIN_ATTEMPTS; attempt += 1) {
      throttle.recordFailure("m1", start);
    }
    expect(throttle.attemptsLeft("m1", start)).toBe(0);
    expect(throttle.attemptsLeft("m1", after(LOCKOUT_MS))).toBe(MAX_PIN_ATTEMPTS);
  });
});
