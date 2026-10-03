import { describe, expect, test } from "bun:test";

import { toTipReport } from "./tip-report";

describe("toTipReport", () => {
  const report = toTipReport({
    shifts: [
      {
        cashShiftId: "sh1",
        closedAt: new Date("2026-10-03T23:30:00Z"),
        distributed: true,
        tipTotal: 10_001,
        shares: [
          { memberId: "m1", displayName: "Ana", amount: 5_001 },
          { memberId: null, displayName: "Chef Luis", amount: 5_000 },
        ],
      },
    ],
    people: [
      { memberId: "m1", displayName: "Ana", amount: 5_001 },
      { memberId: null, displayName: "Chef Luis", amount: 5_000 },
    ],
  });

  test("keeps the shifts with their close time, total and each person's share", () => {
    expect(report.shifts).toEqual([
      {
        cashShiftId: "sh1",
        closedAt: "2026-10-03T23:30:00.000Z",
        tipTotal: 10_001,
        shares: [
          { key: "m1", displayName: "Ana", amount: 5_001 },
          { key: "name:Chef Luis", displayName: "Chef Luis", amount: 5_000 },
        ],
      },
    ]);
  });

  test("sums each person across the period and totals the tips", () => {
    expect(report.people.map((person) => person.key)).toEqual(["m1", "name:Chef Luis"]);
    expect(report.total).toBe(10_001);
  });

  test("an empty period is an empty report", () => {
    expect(toTipReport({ shifts: [], people: [] })).toEqual({ shifts: [], people: [], total: 0 });
  });
});
