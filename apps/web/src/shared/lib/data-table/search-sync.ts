/**
 * Decides whether the route search changed behind the table's back. The table remembers the key
 * of what it last committed (or last saw); a search with another key came from outside (browser
 * back/forward, a link) and must replace any pending local value and cancel its debounced write.
 * The echo of the table's own commit carries the recorded key and is not external.
 */
export function reconcileExternalSearch({
  searchKey,
  committedKey,
}: {
  searchKey: string;
  committedKey: string;
}): { committedKey: string; external: boolean } {
  return searchKey === committedKey
    ? { committedKey, external: false }
    : { committedKey: searchKey, external: true };
}
