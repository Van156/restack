/**
 * Display label for a member role string. better-auth stores multiple roles as one
 * comma-separated string; returns `undefined` when there is nothing to show.
 */
export function formatRoleLabel(role: string | null | undefined): string | undefined {
  const label = role
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
  return label || undefined;
}
