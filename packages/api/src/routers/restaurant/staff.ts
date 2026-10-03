import { hasOwnerRole } from "@base-template/auth/owner-role";
import { hashPin } from "@base-template/auth/staff-credentials";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { accessibleLocationIds, assertLocationAccess } from "../../lib/location-scope";
import type { LocationScopeContext } from "../../lib/location-scope";
import { signActingToken } from "../../lib/acting-token";
import { verifyMemberPin } from "../../lib/pin";

const MAX_LOCATIONS_PER_ASSIGNMENT = 100;

const pin = z.string().regex(/^\d{4,6}$/, "A PIN is 4 to 6 digits.");

/** A member of the caller's organization (a foreign or missing id is NOT_FOUND). */
async function loadOrgMember(context: LocationScopeContext, memberId: string) {
  const [row] = await context.db
    .select({
      id: schema.member.id,
      userId: schema.member.userId,
      role: schema.member.role,
      name: schema.user.name,
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(and(eq(schema.member.id, memberId), eq(schema.member.organizationId, context.org.id)));
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Staff member not found." });
  }
  return row;
}

/** The Owner is the only Role without assignment rows; everyone else needs one per Location. */
async function isAssignedTo(context: LocationScopeContext, memberId: string, locationId: string) {
  const [row] = await context.db
    .select({ id: schema.staffLocationAssignment.id })
    .from(schema.staffLocationAssignment)
    .where(
      and(
        eq(schema.staffLocationAssignment.memberId, memberId),
        eq(schema.staffLocationAssignment.locationId, locationId),
        eq(schema.staffLocationAssignment.organizationId, context.org.id),
      ),
    );
  return Boolean(row);
}

const assignLocationsInput = z.object({
  memberId: z.string().min(1),
  locationIds: z.array(z.string().min(1)).max(MAX_LOCATIONS_PER_ASSIGNMENT),
});

async function storePin(context: LocationScopeContext, memberId: string, value: string) {
  const pinHash = await hashPin(value);
  await context.db
    .insert(schema.staffPin)
    .values({ organizationId: context.org.id, memberId, pinHash })
    .onConflictDoUpdate({
      target: schema.staffPin.memberId,
      set: { pinHash, failedAttempts: 0, lockedUntil: null, updatedAt: new Date() },
    });
}

type AssignmentContext = LocationScopeContext & {
  auditLogger: import("@base-template/auth/audit").AuditLogger;
  session: { user: { id: string } };
};

function recordAssignmentChange(
  context: AssignmentContext,
  memberId: string,
  added: string[],
  removed: string[],
) {
  return context.auditLogger.record({
    scope: "organization",
    organizationId: context.org.id,
    actorUserId: context.session.user.id,
    action: "staff.location_assigned",
    targetType: "member",
    targetId: memberId,
    metadata: { added, removed },
  });
}

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
      const target = await loadOrgMember(context, input.memberId);
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

  /** Adds one Staff Location assignment inside the caller's scope. */
  assign: orgProcedure
    .use(requirePermission({ staff: ["manage"] }))
    .input(z.object({ memberId: z.string().min(1), locationId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      const target = await loadOrgMember(context, input.memberId);
      if (hasOwnerRole(target.role)) {
        throw new ORPCError("FORBIDDEN", { message: "The Owner needs no Location assignments." });
      }
      const inserted = await context.db
        .insert(schema.staffLocationAssignment)
        .values({
          organizationId: context.org.id,
          memberId: target.id,
          locationId: input.locationId,
        })
        .onConflictDoNothing()
        .returning({ id: schema.staffLocationAssignment.id });
      if (inserted.length > 0) {
        await recordAssignmentChange(context, target.id, [input.locationId], []);
      }
      return { memberId: target.id, locationId: input.locationId, added: inserted.length > 0 };
    }),

  /** Removes one Staff Location assignment inside the caller's scope. */
  unassign: orgProcedure
    .use(requirePermission({ staff: ["manage"] }))
    .input(z.object({ memberId: z.string().min(1), locationId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      const target = await loadOrgMember(context, input.memberId);
      const removed = await context.db
        .delete(schema.staffLocationAssignment)
        .where(
          and(
            eq(schema.staffLocationAssignment.memberId, target.id),
            eq(schema.staffLocationAssignment.locationId, input.locationId),
          ),
        )
        .returning({ id: schema.staffLocationAssignment.id });
      if (removed.length > 0) {
        await recordAssignmentChange(context, target.id, [], [input.locationId]);
      }
      return { memberId: target.id, locationId: input.locationId, removed: removed.length > 0 };
    }),

  /**
   * Staff members with their assigned Locations inside the caller's scope, optionally narrowed to
   * one Location. The Owner has no rows and is not listed.
   */
  listAssignments: orgProcedure
    .use(requirePermission({ staff: ["manage"] }))
    .input(z.object({ locationId: z.string().min(1).optional() }))
    .handler(async ({ context, input }) => {
      if (input.locationId) {
        await assertLocationAccess(context, input.locationId);
      }
      const scope = input.locationId ? [input.locationId] : await accessibleLocationIds(context);
      if (scope.length === 0) {
        return [];
      }
      const rows = await context.db
        .select({
          memberId: schema.member.id,
          userId: schema.user.id,
          name: schema.user.name,
          email: schema.user.email,
          role: schema.member.role,
          locationId: schema.staffLocationAssignment.locationId,
        })
        .from(schema.staffLocationAssignment)
        .innerJoin(schema.member, eq(schema.member.id, schema.staffLocationAssignment.memberId))
        .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
        .where(
          and(
            eq(schema.staffLocationAssignment.organizationId, context.org.id),
            inArray(schema.staffLocationAssignment.locationId, scope),
          ),
        );
      const byMember = new Map<
        string,
        {
          memberId: string;
          userId: string;
          name: string;
          email: string;
          role: string;
          locationIds: string[];
        }
      >();
      for (const { locationId, ...member } of rows) {
        const entry = byMember.get(member.memberId) ?? { ...member, locationIds: [] };
        entry.locationIds.push(locationId);
        byMember.set(member.memberId, entry);
      }
      return [...byMember.values()].sort((a, b) => a.name.localeCompare(b.name));
    }),

  /**
   * Attaches Locations to a pending invitation (created through better-auth with its Role); they
   * become Staff Location assignments when it is accepted. Same scope rule as `assignLocations`.
   */
  setInvitationLocations: orgProcedure
    .use(requirePermission({ staff: ["manage"] }))
    .input(
      z.object({
        invitationId: z.string().min(1),
        locationIds: z.array(z.string().min(1)).max(MAX_LOCATIONS_PER_ASSIGNMENT),
      }),
    )
    .handler(async ({ context, input }) => {
      const [invitation] = await context.db
        .select({ id: schema.invitation.id, status: schema.invitation.status })
        .from(schema.invitation)
        .where(
          and(
            eq(schema.invitation.id, input.invitationId),
            eq(schema.invitation.organizationId, context.org.id),
          ),
        );
      if (!invitation) {
        throw new ORPCError("NOT_FOUND", { message: "Invitation not found." });
      }
      if (invitation.status !== "pending") {
        throw new ORPCError("CONFLICT", { message: "This invitation is no longer pending." });
      }

      const scope = new Set(await accessibleLocationIds(context));
      const requested = [...new Set(input.locationIds)];
      if (requested.some((id) => !scope.has(id))) {
        throw new ORPCError("FORBIDDEN", {
          message: "You can only assign Locations you have access to.",
        });
      }

      await context.db.transaction(async (tx) => {
        const existing = (
          await tx
            .select({ locationId: schema.invitationLocation.locationId })
            .from(schema.invitationLocation)
            .where(eq(schema.invitationLocation.invitationId, invitation.id))
        ).map((row) => row.locationId);
        const toRemove = existing.filter((id) => scope.has(id) && !requested.includes(id));
        const toAdd = requested.filter((id) => !existing.includes(id));
        if (toRemove.length > 0) {
          await tx
            .delete(schema.invitationLocation)
            .where(
              and(
                eq(schema.invitationLocation.invitationId, invitation.id),
                inArray(schema.invitationLocation.locationId, toRemove),
              ),
            );
        }
        if (toAdd.length > 0) {
          await tx.insert(schema.invitationLocation).values(
            toAdd.map((locationId) => ({
              organizationId: context.org.id,
              invitationId: invitation.id,
              locationId,
            })),
          );
        }
      });
      return { invitationId: invitation.id, locationIds: requested };
    }),

  /**
   * A Staff member sets their own PIN. Changing an existing PIN needs the current one (counted
   * toward the lockout like any other attempt); forgotten PINs go through `resetPin`.
   */
  setPin: orgProcedure
    .input(z.object({ pin, currentPin: z.string().optional() }))
    .handler(async ({ context, input }) => {
      const [existing] = await context.db
        .select({ id: schema.staffPin.id })
        .from(schema.staffPin)
        .where(eq(schema.staffPin.memberId, context.member.id));
      if (existing) {
        if (!input.currentPin) {
          throw new ORPCError("FORBIDDEN", { message: "The current PIN is required." });
        }
        await verifyMemberPin(context.db, context.clock, {
          organizationId: context.org.id,
          memberId: context.member.id,
          pin: input.currentPin,
        });
      }
      await storePin(context, context.member.id, input.pin);
      return { updated: true };
    }),

  /**
   * An Administrator or the Owner replaces a Staff member's PIN and clears any lockout. An
   * Administrator can only reset Staff of their own Locations, never the Owner. Audited.
   */
  resetPin: orgProcedure
    .use(requirePermission({ staff: ["manage"] }))
    .input(z.object({ memberId: z.string().min(1), pin }))
    .handler(async ({ context, input }) => {
      const target = await loadOrgMember(context, input.memberId);
      if (!hasOwnerRole(context.member.role)) {
        const scope = await accessibleLocationIds(context);
        const reachable =
          !hasOwnerRole(target.role) &&
          (await Promise.all(scope.map((id) => isAssignedTo(context, target.id, id)))).some(
            Boolean,
          );
        if (!reachable) {
          throw new ORPCError("FORBIDDEN", {
            message: "You can only reset the PIN of Staff in your Locations.",
          });
        }
      }
      await storePin(context, target.id, input.pin);
      await context.auditLogger.record({
        scope: "organization",
        organizationId: context.org.id,
        actorUserId: context.session.user.id,
        action: "staff.pin_reset",
        targetType: "member",
        targetId: target.id,
        metadata: { memberName: target.name },
      });
      return { memberId: target.id };
    }),

  /**
   * PIN switch-in on a shared device: the signed-in device session proves who is at the keyboard.
   * Verifies the PIN of a Staff member of the Location and returns their identity so the client
   * attributes the next actions to them. The caller needs access to the Location too. Also returns
   * a short-lived acting token (HMAC, bound to organization, Location, member and expiry) that order
   * procedures accept as `actingToken` to record lines, voids and discounts as made by that member.
   */
  switchIn: orgProcedure
    .input(
      z.object({ locationId: z.string().min(1), memberId: z.string().min(1), pin: z.string() }),
    )
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      const target = await loadOrgMember(context, input.memberId);
      if (
        !hasOwnerRole(target.role) &&
        !(await isAssignedTo(context, target.id, input.locationId))
      ) {
        throw new ORPCError("FORBIDDEN", { message: "This Staff member does not work here." });
      }
      await verifyMemberPin(context.db, context.clock, {
        organizationId: context.org.id,
        memberId: target.id,
        pin: input.pin,
      });
      const { token, expiresAt } = signActingToken(
        context.actingTokenSecret,
        { organizationId: context.org.id, locationId: input.locationId, memberId: target.id },
        context.clock.now(),
      );
      return {
        memberId: target.id,
        userId: target.userId,
        name: target.name,
        role: target.role,
        locationId: input.locationId,
        actingToken: token,
        actingTokenExpiresAt: expiresAt,
      };
    }),
};
