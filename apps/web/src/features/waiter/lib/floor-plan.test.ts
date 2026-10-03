import { describe, expect, test } from "bun:test";

import { buildFloorPlan } from "./floor-plan";

const areas = [
  { id: "a1", name: "Salón" },
  { id: "a2", name: "Terraza" },
  { id: "a3", name: "Barra" },
];
const tables = [
  { id: "t1", areaId: "a1", name: "1", seats: 4 },
  { id: "t2", areaId: "a1", name: "2", seats: 2 },
  { id: "t3", areaId: "a2", name: "T1", seats: 6 },
];
const now = new Date("2026-10-03T20:00:00Z");

describe("buildFloorPlan", () => {
  test("groups Tables under their Area in order, keeping empty Areas", () => {
    const plan = buildFloorPlan({ areas, tables, sessions: [], calls: [], now });
    expect(plan.map((area) => [area.name, area.tables.map((t) => t.name)])).toEqual([
      ["Salón", ["1", "2"]],
      ["Terraza", ["T1"]],
      ["Barra", []],
    ]);
  });

  test("a Table without a session is free", () => {
    const [salon] = buildFloorPlan({ areas, tables, sessions: [], calls: [], now });
    expect(salon?.tables[0]).toMatchObject({
      state: "free",
      sessionId: null,
      hasReadyTicket: false,
      waiterCallAgeMs: null,
    });
  });

  test("maps session status and the ready marker onto the tile", () => {
    const [salon] = buildFloorPlan({
      areas,
      tables,
      sessions: [
        { id: "s1", tableId: "t1", status: "open", hasReadyTicket: true },
        { id: "s2", tableId: "t2", status: "bill_requested", hasReadyTicket: false },
      ],
      calls: [],
      now,
    });
    expect(salon?.tables[0]).toMatchObject({
      state: "occupied",
      sessionId: "s1",
      hasReadyTicket: true,
    });
    expect(salon?.tables[1]).toMatchObject({ state: "bill_requested", sessionId: "s2" });
  });

  test("shows the age of the oldest open call and ignores calls already on the way", () => {
    const sessions = [{ id: "s1", tableId: "t1", status: "open" as const, hasReadyTicket: false }];
    const [salon] = buildFloorPlan({
      areas,
      tables,
      sessions,
      calls: [
        {
          id: "c1",
          tableSessionId: "s1",
          status: "open",
          createdAt: new Date("2026-10-03T19:58:00Z"),
        },
        {
          id: "c2",
          tableSessionId: "s1",
          status: "open",
          createdAt: new Date("2026-10-03T19:59:30Z"),
        },
        {
          id: "c3",
          tableSessionId: "s1",
          status: "on_the_way",
          createdAt: new Date("2026-10-03T19:00:00Z"),
        },
      ],
      now,
    });
    expect(salon?.tables[0]?.waiterCallAgeMs).toBe(120_000);
  });

  test("a call dated after now never yields a negative age", () => {
    const [salon] = buildFloorPlan({
      areas,
      tables,
      sessions: [{ id: "s1", tableId: "t1", status: "open", hasReadyTicket: false }],
      calls: [
        {
          id: "c1",
          tableSessionId: "s1",
          status: "open",
          createdAt: new Date("2026-10-03T20:00:05Z"),
        },
      ],
      now,
    });
    expect(salon?.tables[0]?.waiterCallAgeMs).toBe(0);
  });
});

describe("buildFloorPlan with settled sessions", () => {
  test("a settled session does not occupy its Table", () => {
    const [salon] = buildFloorPlan({
      areas,
      tables,
      sessions: [{ id: "s1", tableId: "t1", status: "settled", hasReadyTicket: false }],
      calls: [],
      now,
    });
    expect(salon?.tables[0]?.state).toBe("free");
  });
});
