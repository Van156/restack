import { describe, expect, test } from "bun:test";

import { resolveBanExpiry } from "./ban-expiry";

const now = new Date("2026-06-01T12:00:00.000Z");

describe("resolveBanExpiry (R6.3: ban with a reason and optional expiry)", () => {
  test("blank input: never expires", () => {
    expect(resolveBanExpiry("", now)).toEqual({ type: "never" });
  });

  test("a future datetime-local value: expires in the right number of seconds", () => {
    // 2026-06-02T12:00 local is exactly 24h after `now` when interpreted in
    // the same local timezone `new Date(datetimeLocalString)` itself uses.
    const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const localValue = toDatetimeLocalValue(future);

    const result = resolveBanExpiry(localValue, now);

    expect(result.type).toBe("expires");
    if (result.type === "expires") {
      expect(result.seconds).toBeGreaterThan(24 * 60 * 60 - 2);
      expect(result.seconds).toBeLessThan(24 * 60 * 60 + 2);
    }
  });

  test("a past datetime: invalid", () => {
    const past = new Date(now.getTime() - 60 * 1000);
    const result = resolveBanExpiry(toDatetimeLocalValue(past), now);
    expect(result.type).toBe("invalid");
  });

  test("an unparseable value: invalid", () => {
    const result = resolveBanExpiry("not-a-date", now);
    expect(result.type).toBe("invalid");
  });
});

/** Formats a `Date` the way a `<input type="datetime-local">` element would produce, in local time. */
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
