import type { Database } from "@base-template/db";
import * as restaurantSchema from "@base-template/db/schema/restaurant";
import * as staffSchema from "@base-template/db/schema/restaurant-staff";
import { eq } from "drizzle-orm";

import type { AuditLogger } from "./audit/types";

/**
 * Turns an invitation's Locations into Staff Location assignments on acceptance (both paths).
 * Idempotent: an existing assignment is left alone.
 */
export async function applyInvitationLocations(
  database: Database,
  auditLogger: AuditLogger,
  input: { invitationId: string; organizationId: string; memberId: string; actorUserId: string },
): Promise<void> {
  const rows = await database
    .select({ locationId: staffSchema.invitationLocation.locationId })
    .from(staffSchema.invitationLocation)
    .where(eq(staffSchema.invitationLocation.invitationId, input.invitationId));
  if (rows.length === 0) {
    return;
  }

  const inserted = await database
    .insert(restaurantSchema.staffLocationAssignment)
    .values(
      rows.map((row) => ({
        organizationId: input.organizationId,
        memberId: input.memberId,
        locationId: row.locationId,
      })),
    )
    .onConflictDoNothing()
    .returning({ locationId: restaurantSchema.staffLocationAssignment.locationId });

  if (inserted.length > 0) {
    await auditLogger.record({
      scope: "organization",
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "staff.location_assigned",
      targetType: "member",
      targetId: input.memberId,
      metadata: {
        added: inserted.map((row) => row.locationId),
        removed: [],
        invitationId: input.invitationId,
      },
    });
  }
}
