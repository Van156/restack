import { hasOwnerRole } from "@base-template/auth/owner-role";
import { resolveOrgRolePermissions } from "@base-template/auth/role-permissions";
import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { and, eq } from "drizzle-orm";

export type RosterMember = {
  memberId: string;
  userId: string;
  name: string;
  role: string;
  permissions: Record<string, string[]>;
};

/**
 * Staff who can work at a Location: those assigned to it plus the Owner, who has no assignment
 * rows (the same rule `staff.switchIn` applies). Permissions are resolved through the member's
 * Roles, so custom Roles count.
 */
export async function loadLocationRoster(
  db: Database,
  organizationId: string,
  locationId: string,
): Promise<RosterMember[]> {
  const rows = await db
    .select({
      memberId: schema.member.id,
      userId: schema.user.id,
      name: schema.user.name,
      role: schema.member.role,
      assignmentId: schema.staffLocationAssignment.id,
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .leftJoin(
      schema.staffLocationAssignment,
      and(
        eq(schema.staffLocationAssignment.memberId, schema.member.id),
        eq(schema.staffLocationAssignment.locationId, locationId),
      ),
    )
    .where(eq(schema.member.organizationId, organizationId));

  const permissionsOfRole = new Map<string, Promise<Record<string, string[]>>>();
  const resolve = (role: string) => {
    let pending = permissionsOfRole.get(role);
    if (!pending) {
      pending = resolveOrgRolePermissions(db, organizationId, role);
      permissionsOfRole.set(role, pending);
    }
    return pending;
  };

  const members = rows.filter((row) => row.assignmentId || hasOwnerRole(row.role));
  return Promise.all(
    members.map(async ({ assignmentId: _assignment, ...row }) => ({
      ...row,
      permissions: await resolve(row.role),
    })),
  ).then((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
}
