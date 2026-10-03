import { parseRoles } from "./role-names";

/** Whether a member's `role` field includes the owner Role. */
export function hasOwnerRole(role: string): boolean {
  return parseRoles(role).includes("owner");
}
