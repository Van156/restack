/**
 * Decides whether a row selection is stale. The selection belongs to one page of results, so it
 * must be cleared when the query key (page, sort, filters) changes; the first key seen and an
 * unchanged key keep it.
 */
export function reconcileSelectionKey({
  previousKey,
  key,
}: {
  previousKey: string | undefined;
  key: string;
}): { key: string; reset: boolean } {
  return { key, reset: previousKey !== undefined && previousKey !== key };
}
