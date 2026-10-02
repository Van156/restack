/** Public API of the access-control feature (spec §4.4). Everything else is internal. */
export { default as CanGate } from "./components/can-gate";
export { default as RolesPage } from "./components/roles-page";
export { useActiveMemberRole } from "./hooks/use-active-member-role";
export { useCallerRoles } from "./hooks/use-caller-roles";
export { useCan } from "./hooks/use-can";
export { useOrgRoles, type OrgRoleRow } from "./hooks/use-org-roles";
export { usePlatformCan } from "./hooks/use-platform-can";
export { ACTIVE_MEMBER_ROLE_QUERY_ROOT, CAN_QUERY_ROOT } from "./lib/query-keys";
export { hasPermissionLoadError } from "./lib/permission-load-error";
export { isSuperadminRole } from "./lib/platform-role";
export {
  assignableRoles,
  buildRoleCatalog,
  resolveCallerPermission,
  type PermissionsRecord,
  type RoleDefinition,
} from "./lib/role-catalog";
