/** A member's `role` field can hold several comma-separated role names. */
export function hasOwnerRole(role: string): boolean {
  return role
    .split(",")
    .map((value) => value.trim())
    .includes("owner");
}
