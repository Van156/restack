import { describe, expect, test } from "bun:test";

import { buildCheckoutRows } from "./checkout-rows";

const tables = [
  { id: "t1", name: "1", areaName: "Salón" },
  { id: "t2", name: "2", areaName: "Salón" },
  { id: "t3", name: "T1", areaName: "Terraza" },
];

describe("buildCheckoutRows", () => {
  test("lists tables that asked for the bill first, then by how long they have been open", () => {
    const rows = buildCheckoutRows(
      [
        { id: "s1", tableId: "t1", status: "open", openedAt: "2026-10-03T19:00:00Z" },
        { id: "s2", tableId: "t2", status: "bill_requested", openedAt: "2026-10-03T20:00:00Z" },
        { id: "s3", tableId: "t3", status: "open", openedAt: "2026-10-03T18:00:00Z" },
      ],
      tables,
    );
    expect(rows.map((row) => row.sessionId)).toEqual(["s2", "s3", "s1"]);
    expect(rows[0]).toEqual({
      sessionId: "s2",
      tableName: "2",
      areaName: "Salón",
      billRequested: true,
    });
  });

  test("ignores settled sessions and names a table it does not know", () => {
    const rows = buildCheckoutRows(
      [
        { id: "s1", tableId: "t1", status: "settled", openedAt: "2026-10-03T19:00:00Z" },
        { id: "s2", tableId: "gone", status: "open", openedAt: "2026-10-03T19:00:00Z" },
      ],
      tables,
    );
    expect(rows).toEqual([
      { sessionId: "s2", tableName: "Mesa", areaName: null, billRequested: false },
    ]);
  });
});
