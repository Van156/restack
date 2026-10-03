import { describe, expect, test } from "bun:test";

import {
  ACTIVATION_MIN_BILLS,
  ACTIVE_WEEK_MIN_CLOSE_DAYS,
  activationStatus,
  isWeeklyActive,
  weekOf,
} from "./product-health";

describe("weekOf", () => {
  test("a Wednesday belongs to the Monday to Sunday week around it", () => {
    expect(weekOf("2026-10-07")).toMatchObject({ weekStart: "2026-10-05", weekEnd: "2026-10-11" });
  });

  test("Monday starts and Sunday ends the same week", () => {
    expect(weekOf("2026-10-05").weekStart).toBe("2026-10-05");
    expect(weekOf("2026-10-11").weekStart).toBe("2026-10-05");
    expect(weekOf("2026-10-12").weekStart).toBe("2026-10-12");
  });

  test("crosses month and year boundaries", () => {
    expect(weekOf("2026-01-01")).toMatchObject({ weekStart: "2025-12-29", weekEnd: "2026-01-04" });
  });

  test("bounds are the Bogota instants of the first day and the day after the last", () => {
    const { bounds } = weekOf("2026-10-07");
    expect(bounds.start.toISOString()).toBe("2026-10-05T05:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-10-12T05:00:00.000Z");
  });

  test("rejects a malformed date", () => {
    expect(() => weekOf("nope")).toThrow();
  });
});

describe("isWeeklyActive", () => {
  test("needs a Cash shift closed on 5 or more days of the week", () => {
    expect(ACTIVE_WEEK_MIN_CLOSE_DAYS).toBe(5);
    expect(isWeeklyActive(4)).toBe(false);
    expect(isWeeklyActive(5)).toBe(true);
    expect(isWeeklyActive(7)).toBe(true);
  });
});

describe("activationStatus", () => {
  const signup = new Date("2026-10-01T15:00:00.000Z");
  const day = 24 * 60 * 60 * 1000;
  const complete = { setupFinished: true, settledBills: ACTIVATION_MIN_BILLS, shiftClosed: true };

  test("all three criteria within the window activate, even before the window ends", () => {
    expect(
      activationStatus({ signedUpAt: signup, now: new Date(signup.getTime() + day), ...complete }),
    ).toBe("activated");
  });

  test("19 Bills is not enough; 20 is", () => {
    const now = new Date(signup.getTime() + 8 * day);
    expect(activationStatus({ signedUpAt: signup, now, ...complete, settledBills: 19 })).toBe(
      "not_activated",
    );
    expect(activationStatus({ signedUpAt: signup, now, ...complete, settledBills: 20 })).toBe(
      "activated",
    );
  });

  test("a missing criterion stays pending while the 7 days run and fails after", () => {
    const missing = { ...complete, shiftClosed: false };
    expect(
      activationStatus({
        signedUpAt: signup,
        now: new Date(signup.getTime() + 6 * day),
        ...missing,
      }),
    ).toBe("pending");
    expect(
      activationStatus({
        signedUpAt: signup,
        now: new Date(signup.getTime() + 7 * day),
        ...missing,
      }),
    ).toBe("not_activated");
  });

  test("setup not finished fails like any other criterion", () => {
    expect(
      activationStatus({
        signedUpAt: signup,
        now: new Date(signup.getTime() + 9 * day),
        ...complete,
        setupFinished: false,
      }),
    ).toBe("not_activated");
  });
});
