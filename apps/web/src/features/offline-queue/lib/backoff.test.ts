import { describe, expect, test } from "bun:test";

import { BACKOFF_BASE_MS, BACKOFF_MAX_MS, backoffDelayMs } from "./backoff";
import { MINUTE_MS } from "./test-support";

describe("backoffDelayMs", () => {
  test("doubles from one minute and caps at one hour", () => {
    const minutes = [1, 2, 3, 4, 5, 6, 7, 8].map(
      (attempts) => backoffDelayMs(attempts) / MINUTE_MS,
    );
    expect(minutes).toEqual([1, 2, 4, 8, 16, 32, 60, 60]);
  });

  test("exposes the schedule bounds", () => {
    expect(BACKOFF_BASE_MS).toBe(MINUTE_MS);
    expect(BACKOFF_MAX_MS).toBe(60 * MINUTE_MS);
  });

  test("stays capped for absurd attempt counts and is zero before the first failure", () => {
    expect(backoffDelayMs(10_000)).toBe(BACKOFF_MAX_MS);
    expect(backoffDelayMs(0)).toBe(0);
  });
});
