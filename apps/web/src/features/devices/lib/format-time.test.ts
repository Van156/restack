import { describe, expect, test } from "bun:test";

import { formatBogotaDateTime, formatBogotaTime } from "./format-time";

describe("Bogota time formatting", () => {
  test("shows the clock time in America/Bogota (UTC-5)", () => {
    expect(formatBogotaTime(new Date("2026-10-03T17:15:00Z"))).toBe("12:15");
  });

  test("shows date and time for a last-seen stamp", () => {
    expect(formatBogotaDateTime(new Date("2026-10-03T17:15:00Z"))).toContain("12:15");
    expect(formatBogotaDateTime(new Date("2026-10-03T17:15:00Z"))).toContain("2026");
  });
});
