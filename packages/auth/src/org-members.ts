import type { Database } from "@base-template/db";
import { buildListQuery } from "@base-template/db/lib/list-query";
import type { ListColumns, ListQueryInput } from "@base-template/db/lib/list-query";
import { member, user } from "@base-template/db/schema/auth";
import { and, count, eq } from "drizzle-orm";

/** One member as read back for the organization members list. */
export type OrganizationMemberRow = {
  id: string;
  userId: string;
  role: string;
  createdAt: Date;
  user: { id: string; name: string; email: string };
};

/** A page of members plus the number of members matching the filters (ignoring paging). */
export type OrganizationMemberPage = {
  members: OrganizationMemberRow[];
  total: number;
};

/** List-input ids to `member`/`user` columns; the only way a client id reaches SQL. */
export const ORGANIZATION_MEMBER_LIST_COLUMNS = {
  name: user.name,
  email: user.email,
  role: member.role,
  createdAt: member.createdAt,
} as const satisfies ListColumns;

/**
 * Members of one organization with name and email. `organizationId` is mandatory and always AND-ed
 * with the filters, so no filter can reach another tenant; pass the session org id (R5.1).
 * See docs/architecture/auth.md#platform-lists
 */
export async function listOrganizationMembers(
  db: Pick<Database, "select">,
  { organizationId, input }: { organizationId: string; input: ListQueryInput },
): Promise<OrganizationMemberPage> {
  const query = buildListQuery({
    columns: ORGANIZATION_MEMBER_LIST_COLUMNS,
    input,
    tieBreakers: [member.id],
  });
  const where = and(eq(member.organizationId, organizationId), query.where);

  const [members, [totalRow]] = await Promise.all([
    db
      .select({
        id: member.id,
        userId: member.userId,
        role: member.role,
        createdAt: member.createdAt,
        user: { id: user.id, name: user.name, email: user.email },
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(where)
      .orderBy(...query.orderBy)
      .limit(query.limit)
      .offset(query.offset),
    // The count joins `user` too: name and email filters reference it.
    db
      .select({ total: count() })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(where),
  ]);
  return { members, total: totalRow?.total ?? 0 };
}
