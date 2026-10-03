import { describe, expect, test } from "bun:test";

import { defaultPeriod, validatePeriod } from "./tip-period";

describe("defaultPeriod", () => {
  test("is today in Colombia time, whatever the UTC date is", () => {
    expect(defaultPeriod(new Date("2026-10-04T03:00:00Z"))).toEqual({
      from: "2026-10-03",
      to: "2026-10-03",
    });
    expect(defaultPeriod(new Date("2026-10-04T06:00:00Z"))).toEqual({
      from: "2026-10-04",
      to: "2026-10-04",
    });
  });
});

describe("validatePeriod", () => {
  test("accepts a day or a range in order", () => {
    expect(validatePeriod({ from: "2026-10-01", to: "2026-10-31" })).toEqual({ ok: true });
    expect(validatePeriod({ from: "2026-10-03", to: "2026-10-03" })).toEqual({ ok: true });
  });

  test("refuses an end before the start and malformed dates", () => {
    expect(validatePeriod({ from: "2026-10-05", to: "2026-10-01" })).toEqual({
      ok: false,
      error: "La fecha final no puede ser anterior a la inicial.",
    });
    expect(validatePeriod({ from: "", to: "2026-10-01" }).ok).toBe(false);
    expect(validatePeriod({ from: "2026-13-01", to: "2026-13-02" }).ok).toBe(false);
  });
});
