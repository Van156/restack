import { hasOwnerRole } from "@base-template/auth/owner-role";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { accessibleLocationIds } from "../../lib/location-scope";

const MAX_LOCATIONS_PER_ASSIGNMENT = 100;

const assignLocationsInput = z.object({
  memberId: z.string().min(1),
  locationIds: z.array(z.string().min(1)).max(MAX_LOCATIONS_PER_ASSIGNMENT),
});

export const staffRouter = {
  /**
   * Sets the Locations a Staff member works in. The caller can only add or remove Locations inside
   * their own scope (the Owner's is every Location); assignments outside it are left untouched.
   * An Owner never needs, and never receives, assignments.
   */
  assignLocations: orgProcedure
    .use(requirePermission({ staff: ["manage"] }))
    .input(assignLocationsInput)
    .handler(async ({ context, input }) => {
      const [target] = await context.db
        .select()
        .from(schema.member)
        .where(
          and(
            eq(schema.member.id, input.memberId),
            eq(schema.member.organizationId, context.org.id),
          ),
        );
      if (!target) {
        throw new ORPCError("NOT_FOUND", { message: "Staff member not found." });
      }
      if (hasOwnerRole(target.role)) {
        throw new ORPCError("FORBIDDEN", { message: "The Owner needs no Location assignments." });
      }

      const scope = new Set(await accessibleLocationIds(context));
      const requested = [...new Set(input.locationIds)];
      if (requested.some((id) => !scope.has(id))) {
        throw new ORPCError("FORBIDDEN", {
          message: "You can only assign Locations you have access to.",
        });
      }

      const { added, removed } = await context.db.transaction(async (tx) => {
        const existing = (
          await tx
            .select({ locationId: schema.staffLocationAssignment.locationId })
            .from(schema.staffLocationAssignment)
            .where(eq(schema.staffLocationAssignment.memberId, target.id))
        ).map((row) => row.locationId);

        const toAdd = requested.filter((id) => !existing.includes(id));
        const toRemove = existing.filter((id) => scope.has(id) && !requested.includes(id));

        if (toRemove.length > 0) {
          await tx
            .delete(schema.staffLocationAssignment)
            .where(
              and(
                eq(schema.staffLocationAssignment.memberId, target.id),
                inArray(schema.staffLocationAssignment.locationId, toRemove),
              ),
            );
        }
        if (toAdd.length > 0) {
          await tx.insert(schema.staffLocationAssignment).values(
            toAdd.map((locationId) => ({
              organizationId: context.org.id,
              memberId: target.id,
              locationId,
            })),
          );
        }
        return { added: toAdd, removed: toRemove };
      });

      if (added.length > 0 || removed.length > 0) {
        await context.auditLogger.record({
          scope: "organization",
          organizationId: context.org.id,
          actorUserId: context.session.user.id,
          action: "staff.location_assigned",
          targetType: "member",
          targetId: target.id,
          metadata: { added, removed },
        });
      }
      return { memberId: target.id, added, removed };
    }),
};
