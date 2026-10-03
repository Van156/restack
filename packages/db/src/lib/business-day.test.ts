import { describe, expect, test } from "bun:test";

import { businessDayBounds, businessDayOf } from "./business-day";

describe("businessDayBounds (America/Bogota, UTC-5, no DST)", () => {
  test("a calendar date spans 05:00 UTC to 05:00 UTC of the next day", () => {
    const { start, end } = businessDayBounds("2026-10-02");
    expect(start.toISOString()).toBe("2026-10-02T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-03T05:00:00.000Z");
  });

  test("crosses month and year boundaries", () => {
    expect(businessDayBounds("2026-12-31").end.toISOString()).toBe("2027-01-01T05:00:00.000Z");
    expect(businessDayBounds("2028-02-28").end.toISOString()).toBe("2028-02-29T05:00:00.000Z");
  });

  test("rejects malformed or impossible dates", () => {
    expect(() => businessDayBounds("2026-13-01")).toThrow();
    expect(() => businessDayBounds("2026-02-30")).toThrow();
    expect(() => businessDayBounds("02/10/2026")).toThrow();
  });
});

describe("businessDayOf", () => {
  test("an instant before 05:00 UTC belongs to the previous Bogota day", () => {
    expect(businessDayOf(new Date("2026-10-02T04:59:59.999Z"))).toBe("2026-10-01");
    expect(businessDayOf(new Date("2026-10-02T05:00:00.000Z"))).toBe("2026-10-02");
  });

  test("a late-night sale in Bogota stays on its own day", () => {
    // 23:30 Bogota on Oct 2 is 04:30 UTC on Oct 3.
    expect(businessDayOf(new Date("2026-10-03T04:30:00.000Z"))).toBe("2026-10-02");
  });

  test("roundtrips with businessDayBounds", () => {
    const { start, end } = businessDayBounds("2026-10-02");
    expect(businessDayOf(start)).toBe("2026-10-02");
    expect(businessDayOf(new Date(end.getTime() - 1))).toBe("2026-10-02");
  });
});
