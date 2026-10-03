export type ComposerGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  modifiers: { id: string; name: string; priceDelta: number }[];
};

export type ComposerItem = { price: number; modifierGroups: ComposerGroup[] };

const groupOf = (item: ComposerItem, modifierId: string) =>
  item.modifierGroups.find((group) =>
    group.modifiers.some((modifier) => modifier.id === modifierId),
  );

/** Toggles a modifier: a single-choice group swaps, a multi-choice group stops at its maximum. */
export function toggleModifier(
  item: ComposerItem,
  selected: readonly string[],
  modifierId: string,
): string[] {
  const group = groupOf(item, modifierId);
  if (!group) {
    return [...selected];
  }
  if (selected.includes(modifierId)) {
    return selected.filter((id) => id !== modifierId);
  }
  const inGroup = selected.filter((id) => groupOf(item, id)?.id === group.id);
  if (group.maxSelect === 1) {
    return [...selected.filter((id) => !inGroup.includes(id)), modifierId];
  }
  return inGroup.length >= group.maxSelect ? [...selected] : [...selected, modifierId];
}

/** Groups under their minimum, by group id, with the Spanish message to show. */
export function groupErrors(
  item: ComposerItem,
  selected: readonly string[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const group of item.modifierGroups) {
    const count = group.modifiers.filter((modifier) => selected.includes(modifier.id)).length;
    if (count < group.minSelect) {
      errors[group.id] = `Elige al menos ${group.minSelect} en «${group.name}».`;
    }
  }
  return errors;
}

/** Price of the composed line: unit price plus chosen deltas, times the quantity. */
export function composerTotal(
  item: ComposerItem,
  selected: readonly string[],
  quantity: number,
): number {
  const deltas = item.modifierGroups
    .flatMap((group) => group.modifiers)
    .filter((modifier) => selected.includes(modifier.id))
    .reduce((sum, modifier) => sum + modifier.priceDelta, 0);
  return (item.price + deltas) * quantity;
}
