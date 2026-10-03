import { describe, expect, test } from "bun:test";

import { isReportDate, todayInBogota } from "./report-date";

describe("todayInBogota", () => {
  test("uses the Bogota business day, not UTC", () => {
    expect(todayInBogota(new Date("2026-10-04T03:30:00.000Z"))).toBe("2026-10-03");
    expect(todayInBogota(new Date("2026-10-04T05:00:00.000Z"))).toBe("2026-10-04");
  });
});

describe("isReportDate", () => {
  test("accepts real calendar days only", () => {
    expect(isReportDate("2026-10-03")).toBe(true);
    expect(isReportDate("2026-02-30")).toBe(false);
    expect(isReportDate("03/10/2026")).toBe(false);
    expect(isReportDate("")).toBe(false);
  });
});
