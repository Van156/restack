/**
 * Whether a `usePlatformCan` query failed on its first load. A query that has data keeps its card
 * rendered through a failed background refetch. Shared by the admin user-detail cards.
 * See docs/architecture/authorization.md#usecan-and-useplatformcan.
 */
export function hasPermissionLoadError(query: { error: unknown; data: unknown }): boolean {
  return Boolean(query.error) && query.data === undefined;
}
