/** A single selectable variant of a prototype. `key` is the `?variant=` value; `name` is a short label. */
export interface PrototypeVariant {
  key: string;
  name: string;
}

/**
 * Builds a TanStack Router `validateSearch` function for a prototype route. Unknown or missing
 * `variant` values fall back to the first variant, so routes stay a few lines.
 */
export function variantSearch(variants: readonly PrototypeVariant[]) {
  return (search: Record<string, unknown>): { variant: string } => {
    const match = variants.find((variant) => variant.key === search.variant);
    return { variant: (match ?? variants[0]).key };
  };
}

/** Returns the key of the variant before/after `current`, wrapping around at both ends. */
export function cycleVariant(
  variants: readonly PrototypeVariant[],
  current: string,
  direction: 1 | -1,
): string {
  const index = Math.max(
    0,
    variants.findIndex((variant) => variant.key === current),
  );
  return variants[(index + direction + variants.length) % variants.length].key;
}
