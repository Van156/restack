import type { DiscountKind, OrderLineModifier } from "../schema/restaurant-orders";
import { orderLineTotal } from "./order-line";
import { deriveTax } from "./tax";
import type { TaxClass } from "./tax";

export type BillLineInput = {
  id: string;
  unitPrice: number;
  modifiers: readonly OrderLineModifier[];
  quantity: number;
  taxClass: TaxClass;
};

export type BillDiscountInput = { kind: DiscountKind; value: number };

export type ComputedBillLine = {
  id: string;
  taxClass: TaxClass;
  /** Line total before discounts. */
  gross: number;
  /** This line's share of the Bill discount. */
  discount: number;
  /** `gross - discount`, tax inclusive. */
  total: number;
  base: number;
  tax: number;
};

export type ComputedBill = {
  lines: ComputedBillLine[];
  subtotal: number;
  discountTotal: number;
  /** `subtotal - discountTotal`; the tip is not part of it. */
  total: number;
  base: number;
  tax: number;
  taxByClass: Record<TaxClass, { base: number; tax: number }>;
};

/** Percent of an amount rounded half up to the whole peso. */
function percentOf(amount: number, percent: number): number {
  return Number((2n * BigInt(amount) * BigInt(percent) + 100n) / 200n);
}

/** Discounts apply in order; each percent is taken from what remains, and the stack stops at zero. */
function totalDiscount(subtotal: number, discounts: readonly BillDiscountInput[]): number {
  let remaining = subtotal;
  for (const discount of discounts) {
    const cut = discount.kind === "amount" ? discount.value : percentOf(remaining, discount.value);
    remaining -= Math.min(cut, remaining);
  }
  return subtotal - remaining;
}

/** Splits `amount` across weights proportionally; leftover pesos go to the largest fractions, earlier first. */
function distribute(amount: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  if (sum === 0 || amount === 0) {
    return weights.map(() => 0);
  }
  const shares = weights.map((weight) => {
    const exact = BigInt(amount) * BigInt(weight);
    return { floor: Number(exact / BigInt(sum)), fraction: exact % BigInt(sum) };
  });
  let leftover = amount - shares.reduce((acc, share) => acc + share.floor, 0);
  const order = shares
    .map((share, index) => ({ index, fraction: share.fraction }))
    .sort((a, b) =>
      a.fraction === b.fraction ? a.index - b.index : a.fraction > b.fraction ? -1 : 1,
    );
  const result = shares.map((share) => share.floor);
  for (const { index } of order) {
    if (leftover === 0) {
      break;
    }
    result[index]! += 1;
    leftover -= 1;
  }
  return result;
}

/**
 * Computes a Bill from its billable lines and discounts: the discount is capped at the subtotal,
 * spread over the lines, and tax is derived once per discounted line. The tip lives outside.
 * See docs/architecture/restaurant.md#bill-computation.
 */
export function computeBill(
  lines: readonly BillLineInput[],
  discounts: readonly BillDiscountInput[],
): ComputedBill {
  const grosses = lines.map((line) => orderLineTotal(line));
  const subtotal = grosses.reduce((acc, gross) => acc + gross, 0);
  const discountTotal = totalDiscount(subtotal, discounts);
  const shares = distribute(discountTotal, grosses);

  const taxByClass: ComputedBill["taxByClass"] = {
    impoconsumo: { base: 0, tax: 0 },
    iva19: { base: 0, tax: 0 },
  };
  const computed = lines.map((line, index): ComputedBillLine => {
    const gross = grosses[index]!;
    const discount = shares[index]!;
    const total = gross - discount;
    const { base, tax } = deriveTax(total, line.taxClass);
    taxByClass[line.taxClass].base += base;
    taxByClass[line.taxClass].tax += tax;
    return { id: line.id, taxClass: line.taxClass, gross, discount, total, base, tax };
  });

  return {
    lines: computed,
    subtotal,
    discountTotal,
    total: subtotal - discountTotal,
    base: computed.reduce((acc, line) => acc + line.base, 0),
    tax: computed.reduce((acc, line) => acc + line.tax, 0),
    taxByClass,
  };
}

/** The suggested tip: a percent of the Bill total (consumption with tax), rounded half up. */
export function suggestedTip(total: number, percent: number): number {
  return percentOf(total, percent);
}
