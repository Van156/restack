import { describe, expect, test } from "bun:test";

import { deriveOfflineState } from "./offline-window";
import { HOUR_MS } from "./test-support";

const since = "2026-10-01T00:00:00.000Z";
const after = (ms: number) => new Date(new Date(since).getTime() + ms);

describe("deriveOfflineState", () => {
  test("online has no duration, alert or block", () => {
    expect(deriveOfflineState(null, after(100 * HOUR_MS))).toEqual({
      online: true,
      offlineSince: null,
      durationMs: 0,
      alert: null,
      contingencyBlocked: false,
    });
  });

  test("alerts at 24 h and 40 h and blocks contingency sales at 48 h", () => {
    const at = (hours: number) => deriveOfflineState(since, after(hours * HOUR_MS - 1));
    expect(at(24)).toMatchObject({ alert: null, contingencyBlocked: false });
    expect(deriveOfflineState(since, after(24 * HOUR_MS))).toMatchObject({ alert: "warn_24h" });
    expect(at(40)).toMatchObject({ alert: "warn_24h", contingencyBlocked: false });
    expect(deriveOfflineState(since, after(40 * HOUR_MS))).toMatchObject({ alert: "warn_40h" });
    expect(at(48)).toMatchObject({ alert: "warn_40h", contingencyBlocked: false });
    expect(deriveOfflineState(since, after(48 * HOUR_MS))).toMatchObject({
      online: false,
      durationMs: 48 * HOUR_MS,
      alert: "warn_40h",
      contingencyBlocked: true,
    });
  });

  test("a device clock behind the start counts as zero duration", () => {
    expect(deriveOfflineState(since, after(-HOUR_MS))).toMatchObject({
      online: false,
      durationMs: 0,
      alert: null,
    });
  });
});
