/** Storage key of the Location the user last picked, per organization. */
export function activeLocationStorageKey(organizationId: string): string {
  return `restack.active-location.${organizationId}`;
}

/**
 * The Location to work in: the stored one while still accessible, else the first active one, else
 * the first. `null` only when the user has no Location.
 */
export function resolveActiveLocationId(
  locations: readonly { id: string; active: boolean }[],
  storedId: string | null,
): string | null {
  if (storedId && locations.some((location) => location.id === storedId)) {
    return storedId;
  }
  return (locations.find((location) => location.active) ?? locations[0])?.id ?? null;
}
