import { describe, expect, test } from "bun:test";

import { formatSaleTime } from "./sale-time";

describe("formatSaleTime", () => {
  test("shows the date and 24 h time in Bogota (UTC-5)", () => {
    expect(formatSaleTime(new Date("2026-10-03T22:05:09Z"))).toBe("03/10/2026 17:05:09");
  });

  test("rolls the date back when UTC is already the next day", () => {
    expect(formatSaleTime(new Date("2026-10-04T02:30:00Z"))).toBe("03/10/2026 21:30:00");
  });
});
