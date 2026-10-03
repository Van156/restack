import { describe, expect, test } from "bun:test";

import { callRows, openCallCount } from "./waiter-calls";

const now = new Date("2026-10-03T20:00:00Z");
const call = (overrides: Partial<Parameters<typeof callRows>[0][number]> = {}) => ({
  id: "c1",
  tableName: "4",
  reason: "need_something" as const,
  status: "open" as const,
  createdAt: new Date("2026-10-03T19:59:00Z"),
  ...overrides,
});

describe("callRows", () => {
  test("lists the oldest call first with its reason, Table and age", () => {
    const rows = callRows(
      [
        call({ id: "late", createdAt: new Date("2026-10-03T19:59:30Z"), reason: "pay" }),
        call({ id: "early", createdAt: new Date("2026-10-03T19:58:00Z") }),
      ],
      now,
    );
    expect(rows.map((row) => row.id)).toEqual(["early", "late"]);
    expect(rows[0]).toMatchObject({
      tableName: "4",
      reasonLabel: "Necesita algo",
      ageMs: 120_000,
    });
    expect(rows[1]?.reasonLabel).toBe("Quiere pagar");
  });

  test("an open call can get 'Voy'; one on the way can only be attended", () => {
    const [open, onTheWay] = callRows(
      [call({ id: "a" }), call({ id: "b", status: "on_the_way" })],
      now,
    );
    expect(open).toMatchObject({ canAcknowledge: true, statusLabel: "Esperando" });
    expect(onTheWay).toMatchObject({ canAcknowledge: false, statusLabel: "En camino" });
  });

  test("never shows a negative age", () => {
    const [row] = callRows([call({ createdAt: new Date("2026-10-03T20:00:10Z") })], now);
    expect(row?.ageMs).toBe(0);
  });
});

describe("openCallCount", () => {
  test("counts calls still waiting for a Waiter", () => {
    expect(
      openCallCount([call(), call({ id: "b", status: "on_the_way" }), call({ id: "c" })]),
    ).toBe(2);
  });
});
