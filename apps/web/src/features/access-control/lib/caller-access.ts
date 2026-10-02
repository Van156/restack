import {
  assignableRoles,
  resolveCallerPermission,
  type PermissionsRecord,
  type RoleDefinition,
} from "./role-catalog";

export type CallerAccess = {
  callerPermission: PermissionsRecord | null;
  assignable: RoleDefinition[];
};

/** The caller's resolved permissions and the roles they may assign; fails closed while `memberRole` is unresolved. */
export function resolveCallerAccess(
  roleCatalog: readonly RoleDefinition[],
  memberRole: string | undefined,
): CallerAccess {
  const callerPermission = memberRole ? resolveCallerPermission(memberRole, roleCatalog) : null;
  return { callerPermission, assignable: assignableRoles(roleCatalog, callerPermission) };
}
