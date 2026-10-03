/** Tax class of a Menu item: impoconsumo 8% (default) or IVA 19% (franchise). */
export type TaxClass = "impoconsumo" | "iva19";

/** Statutory rate of each tax class, in whole percent. Menu prices include this tax. */
export const TAX_RATE_PERCENT: Record<TaxClass, number> = { impoconsumo: 8, iva19: 19 };

export type DerivedTax = { base: number; tax: number; total: number };

/**
 * Splits an inclusive line amount (integer COP) into base and tax. The base is `total / (1 + rate)`
 * rounded half up to the whole peso, once per line; the tax is the remainder, so `base + tax` always
 * equals the total. Integer-only (BigInt) arithmetic, so no float drift at any size.
 */
export function deriveTax(total: number, taxClass: TaxClass): DerivedTax {
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new RangeError("Line amount must be a non-negative integer number of pesos.");
  }
  const divisor = BigInt(100 + TAX_RATE_PERCENT[taxClass]);
  // round_half_up(total * 100 / divisor) == floor((2 * total * 100 + divisor) / (2 * divisor))
  const base = (2n * BigInt(total) * 100n + divisor) / (2n * divisor);
  return { base: Number(base), tax: total - Number(base), total };
}
