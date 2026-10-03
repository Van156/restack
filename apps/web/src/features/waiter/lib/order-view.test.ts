import { describe, expect, test } from "bun:test";

import { buildOrderView, lineTotal, type ServerLine } from "./order-view";

function serverLine(overrides: Partial<ServerLine> = {}): ServerLine {
  return {
    id: "l1",
    idempotencyKey: "k1",
    itemName: "Hamburguesa",
    unitPrice: 20_000,
    quantity: 2,
    modifiers: [],
    note: null,
    voided: false,
    ticketId: null,
    ...overrides,
  };
}

describe("lineTotal", () => {
  test("adds modifier deltas to the recorded unit price before multiplying", () => {
    expect(
      lineTotal({
        unitPrice: 20_000,
        quantity: 2,
        modifiers: [{ priceDelta: 2_000 }, { priceDelta: -500 }],
      }),
    ).toBe(43_000);
  });
});

describe("buildOrderView", () => {
  test("labels a line with a Ticket as sent and one without as unsent", () => {
    const view = buildOrderView([
      serverLine(),
      serverLine({ id: "l2", idempotencyKey: "k2", ticketId: "tk1" }),
    ]);
    expect(view.lines.map((line) => [line.id, line.state])).toEqual([
      ["l1", "unsent"],
      ["l2", "sent"],
    ]);
    expect(view.hasUnsent).toBe(true);
  });

  test("a voided line shows as voided and never counts in the total or as unsent", () => {
    const view = buildOrderView([
      serverLine({ voided: true }),
      serverLine({ id: "l2", idempotencyKey: "k2", unitPrice: 5_000, quantity: 1, ticketId: "t" }),
    ]);
    expect(view.lines[0]?.state).toBe("voided");
    expect(view.total).toBe(5_000);
    expect(view.hasUnsent).toBe(false);
  });

  test("carries modifier names, note and line total for the strip", () => {
    const view = buildOrderView([
      serverLine({
        modifiers: [{ modifierId: "m1", name: "Sin cebolla", priceDelta: 0 }],
        note: "Bien cocida",
      }),
    ]);
    expect(view.lines[0]).toMatchObject({
      name: "Hamburguesa",
      quantity: 2,
      modifiers: ["Sin cebolla"],
      note: "Bien cocida",
      total: 40_000,
    });
  });
});
