import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema/auth";
import { and, eq, inArray } from "drizzle-orm";

import { isBuiltInOrgRole, orgRoles } from "./permissions";
import type { PermissionsRecord } from "./permissions";
import { parseRoles } from "./role-names";

/** Merges `source`'s `feature: [actions]` entries into `target` (in place, deduped via `Set`). */
function mergePermissionsInto(
  target: Record<string, Set<string>>,
  source: PermissionsRecord,
): void {
  for (const [feature, actions] of Object.entries(source)) {
    const set = target[feature] ?? (target[feature] = new Set());
    for (const action of actions) {
      set.add(action);
    }
  }
}

/**
 * Aggregates the permissions of comma-separated built-in or custom org roles. Unknown names grant
 * nothing; better-auth validates role names before `beforeCreateInvitation` runs.
 */
export async function resolveOrgRolePermissions(
  database: Database,
  organizationId: string,
  roleField: string,
): Promise<Record<string, string[]>> {
  const roleNames = parseRoles(roleField);

  const permissions: Record<string, Set<string>> = {};
  for (const name of roleNames) {
    if (isBuiltInOrgRole(name)) {
      mergePermissionsInto(permissions, orgRoles[name].statements);
    }
  }

  const customRoleNames = roleNames.filter((name) => !isBuiltInOrgRole(name));
  if (customRoleNames.length > 0) {
    const customRoles = await database
      .select({ permission: schema.organizationRole.permission })
      .from(schema.organizationRole)
      .where(
        and(
          eq(schema.organizationRole.organizationId, organizationId),
          inArray(schema.organizationRole.role, customRoleNames),
        ),
      );
    for (const row of customRoles) {
      mergePermissionsInto(permissions, JSON.parse(row.permission) as PermissionsRecord);
    }
  }

  return Object.fromEntries(
    Object.entries(permissions).map(([feature, actions]) => [feature, [...actions]]),
  );
}

/** Whether every `feature:action` pair in `required` is also in `granted`. R2.2 */
export function includesAllPermissions(
  granted: Record<string, string[]>,
  required: Record<string, string[]>,
): boolean {
  return Object.entries(required).every(([feature, actions]) =>
    actions.every((action) => granted[feature]?.includes(action) ?? false),
  );
}
