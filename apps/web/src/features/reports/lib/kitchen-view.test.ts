import { describe, expect, test } from "bun:test";

import { toKitchenRows, type KitchenReportSource, type TimingSource } from "./kitchen-view";

const timing = (over: Partial<TimingSource>): TimingSource => ({
  ticketCount: 10,
  completedCount: 8,
  avgPrepMs: 9 * 60_000,
  maxPrepMs: 20 * 60_000,
  avgPickupMs: 2 * 60_000,
  maxPickupMs: 5 * 60_000,
  avgSentToReadyMs: 12 * 60_000,
  maxSentToReadyMs: 25 * 60_000,
  ...over,
});

const report: KitchenReportSource = {
  date: "2026-10-03",
  total: timing({}),
  byLocation: [{ locationId: "a", name: "Centro", ...timing({ ticketCount: 4 }) }],
};

describe("toKitchenRows", () => {
  test("formats the three timings as averages and worst cases", () => {
    const view = toKitchenRows(report);
    expect(view.total).toMatchObject({
      ticketCount: 10,
      completedCount: 8,
      sentToReady: { average: "12 min", worst: "25 min" },
      preparation: { average: "9 min", worst: "20 min" },
      pickup: { average: "2 min", worst: "5 min" },
    });
  });

  test("a timing nobody has reached yet is a dash", () => {
    const view = toKitchenRows({
      ...report,
      total: timing({ avgPickupMs: null, maxPickupMs: null }),
    });
    expect(view.total.pickup).toEqual({ average: "—", worst: "—" });
  });

  test("one row per Location and an empty flag when no Ticket was sent", () => {
    expect(toKitchenRows(report).locations.map((row) => row.name)).toEqual(["Centro"]);
    expect(toKitchenRows({ ...report, total: timing({ ticketCount: 0 }) }).isEmpty).toBe(true);
    expect(toKitchenRows(report).isEmpty).toBe(false);
  });
});
