import { useMemo } from "react";

import { resolveCallerAccess } from "../lib/caller-access";
import { buildRoleCatalog } from "../lib/role-catalog";
import { useActiveMemberRole } from "./use-active-member-role";
import { useOrgRoles } from "./use-org-roles";

/** The organization's role catalog with the caller's permissions and assignable roles, memoized so consumers keep stable identities. */
export function useCallerRoles(activeOrganizationId: string | undefined) {
  const activeMemberRole = useActiveMemberRole(activeOrganizationId);
  const orgRolesQuery = useOrgRoles(activeOrganizationId);
  const roleCatalog = useMemo(
    () => buildRoleCatalog(orgRolesQuery.data ?? []),
    [orgRolesQuery.data],
  );
  const { callerPermission, assignable } = useMemo(
    () => resolveCallerAccess(roleCatalog, activeMemberRole.data),
    [roleCatalog, activeMemberRole.data],
  );

  return {
    roleCatalog,
    callerPermission,
    assignable,
    rolesError: orgRolesQuery.isError ? orgRolesQuery.error : null,
  };
}
