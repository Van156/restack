import type { OrderLineModifier } from "../schema/restaurant-orders";

/** The recorded price fields of an Order line; the price is never recomputed from the menu. */
type PricedLine = {
  unitPrice: number;
  modifiers: readonly OrderLineModifier[];
};

/** Price of one unit: the price recorded at order time plus every selected modifier delta (integer COP). */
export function orderLineUnitTotal(line: PricedLine): number {
  return line.modifiers.reduce((sum, modifier) => sum + modifier.priceDelta, line.unitPrice);
}

/** Total of an Order line (integer COP, tax inclusive): the unit total times the quantity. */
export function orderLineTotal(line: PricedLine & { quantity: number }): number {
  return orderLineUnitTotal(line) * line.quantity;
}
