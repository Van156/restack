/** Query key scoped to the active organization, so switching organization never reuses a cache. */
export function orgQueryKey(
  organizationId: string | undefined,
  ...parts: readonly unknown[]
): readonly unknown[] {
  return ["org", organizationId, ...parts];
}
