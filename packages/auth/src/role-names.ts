/** Splits a member's `role` field, which can hold several comma-separated role names. */
export function parseRoles(role: string): string[] {
  return role
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
