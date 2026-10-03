/**
 * Whether the page is worth showing to a member at a Location. Only a plain Waiter is hidden when
 * waiters cannot charge; any other Role may hold the permission, which the server checks.
 */
export function mayChargeAt(
  role: string | undefined,
  location: { waitersCanCharge: boolean },
): boolean {
  if (location.waitersCanCharge || role === undefined) {
    return true;
  }
  const roles = role
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return !(roles.length === 1 && roles[0] === "waiter");
}
