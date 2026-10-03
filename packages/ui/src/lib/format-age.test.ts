import { describe, expect, test } from "bun:test";

import { formatAge } from "./format-age";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe("formatAge", () => {
  test("shows less than a minute below 60 seconds", () => {
    expect(formatAge(0)).toBe("< 1 min");
    expect(formatAge(59_999)).toBe("< 1 min");
  });

  test("shows whole minutes below an hour", () => {
    expect(formatAge(MINUTE)).toBe("1 min");
    expect(formatAge(12 * MINUTE + 40_000)).toBe("12 min");
    expect(formatAge(HOUR - 1)).toBe("59 min");
  });

  test("shows hours and minutes from an hour on", () => {
    expect(formatAge(HOUR)).toBe("1 h");
    expect(formatAge(HOUR + 5 * MINUTE)).toBe("1 h 5 min");
    expect(formatAge(26 * HOUR + 30 * MINUTE)).toBe("26 h 30 min");
  });

  test("treats a negative age (device clock behind the server) as zero", () => {
    expect(formatAge(-5000)).toBe("< 1 min");
  });
});
