// Query keys of the caller's role and permission checks, shared by the hooks that read them and
// by every mutation that must refresh them.

export const ACTIVE_MEMBER_ROLE_QUERY_ROOT = "active-member-role";
export const CAN_QUERY_ROOT = "can";

export function activeMemberRoleQueryKey(activeOrganizationId: string | undefined) {
  return [ACTIVE_MEMBER_ROLE_QUERY_ROOT, activeOrganizationId] as const;
}

export function canQueryKey(
  activeOrganizationId: string | undefined,
  role: string | undefined,
  permission: string,
) {
  return [CAN_QUERY_ROOT, activeOrganizationId, role, permission] as const;
}
