import {
  BUILT_IN_ORG_ROLES,
  listCatalogPermissions,
  orgRoles,
} from "@base-template/auth/permissions";

/** better-auth's object-shaped permission set: `{ feature: [action, ...] }`. */
export type PermissionsRecord = Record<string, string[]>;

export type RoleDefinition = {
  name: string;
  permission: PermissionsRecord;
  /** Code-defined (`owner`/`admin`/`member`, immutable per R4.4) vs. stored in `organizationRole`. */
  builtIn: boolean;
};

/** Built-in roles in their fixed order, then the organization's custom roles (R4) as fetched. */
export function buildRoleCatalog(
  customRoles: readonly { role: string; permission: PermissionsRecord }[],
): RoleDefinition[] {
  const builtIns: RoleDefinition[] = BUILT_IN_ORG_ROLES.map((name) => ({
    name,
    // Readonly literal tuples; the UI only reads them, so the cast is safe at runtime.
    // See docs/architecture/authorization.md#role-catalog-role-catalogts.
    permission: orgRoles[name].statements as unknown as PermissionsRecord,
    builtIn: true,
  }));
  const custom: RoleDefinition[] = customRoles.map((role) => ({
    name: role.role,
    permission: role.permission,
    builtIn: false,
  }));
  return [...builtIns, ...custom];
}

/** Looks up a role by exact, case-sensitive name, as better-auth stores it. */
export function findRoleDefinition(
  roles: readonly RoleDefinition[],
  name: string,
): RoleDefinition | undefined {
  return roles.find((role) => role.name === name);
}

/** Whether `holder` has every permission `candidate` grants: the no-escalation rule of R2.2, R3.2 and R4.2. UX only; the server re-validates. */
export function isPermissionSubset(
  candidate: PermissionsRecord,
  holder: PermissionsRecord,
): boolean {
  return Object.entries(candidate).every(([feature, actions]) =>
    actions.every((action) => (holder[feature] ?? []).includes(action)),
  );
}

/** Roles the caller may assign: all their permissions must be held by the caller. `[]` when the caller's permissions are unresolved (fail closed). */
export function assignableRoles(
  roles: readonly RoleDefinition[],
  callerPermission: PermissionsRecord | null,
): RoleDefinition[] {
  if (!callerPermission) {
    return [];
  }
  return roles.filter((role) => isPermissionSubset(role.permission, callerPermission));
}

/** The unioned permissions of a (possibly comma-separated) `member.role`. Unknown names are skipped; `null` when none resolve. */
export function resolveCallerPermission(
  memberRole: string,
  roles: readonly RoleDefinition[],
): PermissionsRecord | null {
  const roleNames = memberRole
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const matched = roleNames
    .map((name) => findRoleDefinition(roles, name))
    .filter((role): role is RoleDefinition => Boolean(role));
  if (matched.length === 0) {
    return null;
  }
  const union: PermissionsRecord = {};
  for (const role of matched) {
    for (const [feature, actions] of Object.entries(role.permission)) {
      union[feature] = [...new Set([...(union[feature] ?? []), ...actions])];
    }
  }
  return union;
}

/** Case-insensitive: better-auth 1.7.5 lowercases role names before its collision checks. See docs/architecture/authorization.md#role-catalog-role-catalogts. */
export function isDuplicateRoleName(name: string, existingNames: readonly string[]): boolean {
  const normalized = name.toLowerCase();
  return existingNames.some((existing) => existing.toLowerCase() === normalized);
}

export type CatalogFeatureGroup = { feature: string; actions: string[] };

/** The `feature:action` catalog grouped by feature, for the roles editor's matrix (R4.1). New catalog features appear automatically. */
export function groupCatalogByFeature(): CatalogFeatureGroup[] {
  const byFeature = new Map<string, string[]>();
  for (const entry of listCatalogPermissions()) {
    const separatorIndex = entry.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }
    const feature = entry.slice(0, separatorIndex);
    const action = entry.slice(separatorIndex + 1);
    const actions = byFeature.get(feature);
    if (actions) {
      actions.push(action);
    } else {
      byFeature.set(feature, [action]);
    }
  }
  return [...byFeature.entries()].map(([feature, actions]) => ({ feature, actions }));
}
