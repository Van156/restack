import { hasOwnerRole } from "@base-template/auth/owner-role";
import { resolveOrgRolePermissions } from "@base-template/auth/role-permissions";
import * as schema from "@base-template/db/schema";
import { OVERRIDE_ACTIONS } from "@base-template/db/schema/restaurant-staff";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure } from "../../index";
import { assertLocationAccess } from "../../lib/location-scope";
import { OVERRIDE_TTL_MINUTES } from "../../lib/override";
import { verifyMemberPin } from "../../lib/pin";

const MINUTE_MS = 60 * 1000;
const CANNOT_APPROVE = "This Staff member cannot approve here.";

export const overridesRouter = {
  /**
   * Mints an Override once the approver's PIN checks out. The caller (the requester) must work in
   * the Location; the approver must hold `override:give` and be assigned to it (the Owner is
   * exempt). The Override is bound to Location, action and target, expires in minutes and is spent
   * by `consumeOverride` (`lib/override.ts`) in the procedure that performs the guarded action.
   */
  mint: orgProcedure
    .input(
      z.object({
        locationId: z.string().min(1),
        action: z.enum(OVERRIDE_ACTIONS),
        target: z.string().min(1),
        approverMemberId: z.string().min(1),
        approverPin: z.string(),
      }),
    )
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);

      const [approver] = await context.db
        .select({ id: schema.member.id, role: schema.member.role })
        .from(schema.member)
        .where(
          and(
            eq(schema.member.id, input.approverMemberId),
            eq(schema.member.organizationId, context.org.id),
          ),
        );
      if (!approver) {
        throw new ORPCError("FORBIDDEN", { message: CANNOT_APPROVE });
      }
      const permissions = await resolveOrgRolePermissions(
        context.db,
        context.org.id,
        approver.role,
      );
      if (!permissions.override?.includes("give")) {
        throw new ORPCError("FORBIDDEN", { message: CANNOT_APPROVE });
      }
      if (approver.id === context.member.id && !hasOwnerRole(approver.role)) {
        throw new ORPCError("FORBIDDEN", { message: CANNOT_APPROVE });
      }
      if (!hasOwnerRole(approver.role)) {
        const [assignment] = await context.db
          .select({ id: schema.staffLocationAssignment.id })
          .from(schema.staffLocationAssignment)
          .where(
            and(
              eq(schema.staffLocationAssignment.memberId, approver.id),
              eq(schema.staffLocationAssignment.locationId, input.locationId),
            ),
          );
        if (!assignment) {
          throw new ORPCError("FORBIDDEN", { message: CANNOT_APPROVE });
        }
      }

      await verifyMemberPin(context.db, context.clock, {
        organizationId: context.org.id,
        memberId: approver.id,
        pin: input.approverPin,
      });

      const expiresAt = new Date(context.clock.now().getTime() + OVERRIDE_TTL_MINUTES * MINUTE_MS);
      const [created] = await context.db
        .insert(schema.override)
        .values({
          organizationId: context.org.id,
          locationId: input.locationId,
          approverMemberId: approver.id,
          requesterMemberId: context.member.id,
          action: input.action,
          target: input.target,
          expiresAt,
        })
        .returning({ id: schema.override.id });
      await context.auditLogger.record({
        scope: "organization",
        organizationId: context.org.id,
        actorUserId: context.session.user.id,
        action: "override.granted",
        targetType: "override",
        targetId: created!.id,
        metadata: {
          locationId: input.locationId,
          action: input.action,
          target: input.target,
          approverMemberId: approver.id,
          expiresAt: expiresAt.toISOString(),
        },
      });
      return { overrideId: created!.id, expiresAt };
    }),
};
