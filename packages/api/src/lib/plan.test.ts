import { describe, expect, test } from "bun:test";

import { FAIR_USE_DOCUMENTS_PER_MONTH, exceedsFairUse, trialState } from "./plan";

const now = new Date("2026-10-02T15:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("trialState", () => {
  test("no trial end means no trial", () => {
    expect(trialState({ trialEndsAt: null }, now)).toEqual({
      status: "none",
      endsAt: null,
      daysRemaining: 0,
    });
  });

  test("an end in the future is active and counts started days", () => {
    const endsAt = new Date(now.getTime() + 2 * DAY_MS + 1);
    expect(trialState({ trialEndsAt: endsAt }, now)).toEqual({
      status: "active",
      endsAt,
      daysRemaining: 3,
    });
  });

  test("the instant of the end is already expired", () => {
    expect(trialState({ trialEndsAt: now }, now)).toEqual({
      status: "expired",
      endsAt: now,
      daysRemaining: 0,
    });
  });
});

describe("exceedsFairUse", () => {
  test("flags only counts above the ceiling", () => {
    expect(exceedsFairUse(FAIR_USE_DOCUMENTS_PER_MONTH)).toBe(false);
    expect(exceedsFairUse(FAIR_USE_DOCUMENTS_PER_MONTH + 1)).toBe(true);
  });
});
