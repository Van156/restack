import { hasOwnerRole } from "@base-template/auth/owner-role";
import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

/** What every restaurant procedure has after `orgProcedure`: the organization and caller from the session. */
export type LocationScopeContext = {
  db: Database;
  org: { id: string };
  member: { id: string; role: string };
};

export type LocationRow = typeof schema.location.$inferSelect;

/**
 * Location scope, checked server-side inside every restaurant procedure. The Owner is exempt (no
 * assignment rows); every other Role needs a Staff Location assignment. A Location of another
 * organization is indistinguishable from a missing one, so identifiers never leak across tenants.
 */
export async function assertLocationAccess(
  context: LocationScopeContext,
  locationId: string,
): Promise<LocationRow> {
  const [row] = await context.db
    .select()
    .from(schema.location)
    .where(
      and(eq(schema.location.id, locationId), eq(schema.location.organizationId, context.org.id)),
    );

  if (hasOwnerRole(context.member.role)) {
    if (!row) {
      throw new ORPCError("NOT_FOUND", { message: "Location not found." });
    }
    return row;
  }

  const [assignment] = row
    ? await context.db
        .select({ id: schema.staffLocationAssignment.id })
        .from(schema.staffLocationAssignment)
        .where(
          and(
            eq(schema.staffLocationAssignment.memberId, context.member.id),
            eq(schema.staffLocationAssignment.locationId, locationId),
            eq(schema.staffLocationAssignment.organizationId, context.org.id),
          ),
        )
    : [];
  if (!row || !assignment) {
    throw new ORPCError("FORBIDDEN", { message: "You do not have access to this Location." });
  }
  return row;
}

/** Ids of the Locations the caller may act in: all of the organization's for the Owner, else assigned ones. */
export async function accessibleLocationIds(context: LocationScopeContext): Promise<string[]> {
  if (hasOwnerRole(context.member.role)) {
    const rows = await context.db
      .select({ id: schema.location.id })
      .from(schema.location)
      .where(eq(schema.location.organizationId, context.org.id));
    return rows.map((row) => row.id);
  }
  const rows = await context.db
    .select({ id: schema.staffLocationAssignment.locationId })
    .from(schema.staffLocationAssignment)
    .innerJoin(schema.location, eq(schema.location.id, schema.staffLocationAssignment.locationId))
    .where(
      and(
        eq(schema.staffLocationAssignment.memberId, context.member.id),
        eq(schema.location.organizationId, context.org.id),
      ),
    );
  return rows.map((row) => row.id);
}
