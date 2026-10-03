import { describe, expect, test } from "bun:test";

import { orderLineTotal, orderLineUnitTotal } from "./order-line";

describe("order line totals", () => {
  test("unit total adds modifier deltas to the recorded price", () => {
    expect(
      orderLineUnitTotal({
        unitPrice: 20_000,
        modifiers: [
          { modifierId: "m1", name: "Queso extra", priceDelta: 2_000 },
          { modifierId: "m2", name: "Sin salsa", priceDelta: -500 },
        ],
      }),
    ).toBe(21_500);
  });

  test("line total multiplies the unit total by the quantity", () => {
    expect(
      orderLineTotal({
        unitPrice: 10_800,
        quantity: 3,
        modifiers: [{ modifierId: "m1", name: "Grande", priceDelta: 1_000 }],
      }),
    ).toBe(35_400);
  });

  test("a line without modifiers is price times quantity", () => {
    expect(orderLineTotal({ unitPrice: 5_000, quantity: 2, modifiers: [] })).toBe(10_000);
  });
});
