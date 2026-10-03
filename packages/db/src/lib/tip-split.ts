export type TipShare = {
  /** Agreed whole-number percent; omit on every share for an equal split. */
  sharePercent?: number | null;
};

/**
 * Splits a tip total in whole COP: equal when no share has a percent, else by agreed percents that
 * sum to 100. Leftover pesos go one each to the largest fraction, earlier beneficiaries first on
 * ties (equal split: the first ones). See docs/architecture/restaurant.md#tip-distribution.
 */
export function splitTips(total: number, shares: readonly TipShare[]): number[] {
  if (!Number.isInteger(total) || total < 0) {
    throw new Error("The tip total must be a whole, non-negative amount.");
  }
  if (shares.length === 0) {
    throw new Error("A tip split needs at least one beneficiary.");
  }
  const percents = shares.map((share) => share.sharePercent ?? null);
  const withPercent = percents.filter((percent) => percent !== null).length;
  if (withPercent !== 0 && withPercent !== shares.length) {
    throw new Error("Either every beneficiary has a percent or none does.");
  }

  // Weights as integers: 1 each for an equal split, the percent otherwise.
  const weights = withPercent === 0 ? shares.map(() => 1) : (percents as number[]);
  if (withPercent !== 0) {
    if (weights.some((weight) => !Number.isInteger(weight) || weight < 1)) {
      throw new Error("Each percent must be a whole number of at least 1.");
    }
    if (weights.reduce((sum, weight) => sum + weight, 0) !== 100) {
      throw new Error("The percents must add up to 100.");
    }
  }
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  const floors = weights.map((weight) => Math.floor((total * weight) / weightSum));
  const fractions = weights.map((weight) => (total * weight) % weightSum);
  let leftover = total - floors.reduce((sum, floor) => sum + floor, 0);
  const order = weights
    .map((_, index) => index)
    .sort((a, b) => fractions[b]! - fractions[a]! || a - b);
  for (const index of order) {
    if (leftover === 0) break;
    floors[index]! += 1;
    leftover -= 1;
  }
  return floors;
}
