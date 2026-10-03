import { describe, expect, test } from "bun:test";

import { offlineBannerKind } from "./offline-banner-state";

const HOUR = 3_600_000;

describe("offlineBannerKind", () => {
  test("is online when connected, whatever the stale duration says", () => {
    expect(
      offlineBannerKind({
        online: true,
        durationMs: 50 * HOUR,
        alert: "warn_40h",
        contingencyBlocked: true,
      }),
    ).toBe("online");
  });

  test("is plain offline before any alert", () => {
    expect(
      offlineBannerKind({
        online: false,
        durationMs: HOUR,
        alert: null,
        contingencyBlocked: false,
      }),
    ).toBe("offline");
  });

  test("escalates with the 24 h and 40 h alerts", () => {
    expect(
      offlineBannerKind({
        online: false,
        durationMs: 25 * HOUR,
        alert: "warn_24h",
        contingencyBlocked: false,
      }),
    ).toBe("warn_24h");
    expect(
      offlineBannerKind({
        online: false,
        durationMs: 41 * HOUR,
        alert: "warn_40h",
        contingencyBlocked: false,
      }),
    ).toBe("warn_40h");
  });

  test("the 48 h block wins over any alert", () => {
    expect(
      offlineBannerKind({
        online: false,
        durationMs: 49 * HOUR,
        alert: "warn_40h",
        contingencyBlocked: true,
      }),
    ).toBe("blocked");
  });
});
