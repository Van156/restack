import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema/auth";
import { eq } from "drizzle-orm";

import { hasOwnerRole } from "./owner-role";

/** Error code for a target at their owned-org limit; shared by the better-auth hook and the API router. */
export const TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS =
  "TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS";

/** A database handle or an open transaction (only `select` is needed). */
type Selectable = Pick<Database, "select">;

/** Counts organizations where `userId` is `owner`; only ownership counts toward the limit (R1.1b). */
export async function countOwnedOrganizations(
  database: Selectable,
  userId: string,
): Promise<number> {
  const rows = await database
    .select({ role: schema.member.role })
    .from(schema.member)
    .where(eq(schema.member.userId, userId));
  return rows.filter((row) => hasOwnerRole(row.role)).length;
}

/**
 * Whether `userId` already owns as many organizations as their effective limit allows
 * (R1.1b, R9.1): `user.maxOrganizations` when set, else `defaultLimit`.
 */
export async function hasReachedOwnedOrgLimit(
  database: Selectable,
  userId: string,
  defaultLimit: number,
): Promise<boolean> {
  const [row] = await database
    .select({ maxOrganizations: schema.user.maxOrganizations })
    .from(schema.user)
    .where(eq(schema.user.id, userId));
  const effectiveLimit = row?.maxOrganizations ?? defaultLimit;
  return (await countOwnedOrganizations(database, userId)) >= effectiveLimit;
}
