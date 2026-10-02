import {
  hasReachedOwnedOrgLimit,
  TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS,
} from "@base-template/auth/org-limit";
import { hasOwnerRole } from "@base-template/auth/owner-role";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure } from "../index";

/** Same code better-auth's hook (T1, R9.1) rejects with, so the UI maps one error for both paths. */
function targetLimitError() {
  return new ORPCError(TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS, {
    status: 403,
    message: "The target has reached their maximum number of owned organizations.",
  });
}

const transferOwnershipInput = z.object({
  organizationId: z.string().min(1),
  targetMemberId: z.string().min(1),
});

/**
 * Organization lifecycle mutations (spec account-and-org-settings §6.5).
 *
 * `transferOwnership` is deliberately an `orgProcedure`: the organization comes from the session
 * (`context.org`, which also proves membership), never from client input. `organizationId` is
 * still part of the input per the spec, but only as an explicit confirmation: it must equal the
 * active organization, otherwise the call is rejected (`BAD_REQUEST`) rather than acting on
 * either organization.
 */
export const organizationRouter = {
  transferOwnership: orgProcedure
    .input(transferOwnershipInput)
    .handler(async ({ context, input }) => {
      if (input.organizationId !== context.org.id) {
        throw new ORPCError("BAD_REQUEST", {
          message: "organizationId does not match the active organization.",
        });
      }
      // R8.2: only an owner may transfer. Multi-role strings ("owner,custom") are parsed, not compared.
      if (!hasOwnerRole(context.member.role)) {
        throw new ORPCError("FORBIDDEN", { message: "Only an owner can transfer ownership." });
      }
      if (input.targetMemberId === context.member.id) {
        throw new ORPCError("BAD_REQUEST", {
          message: "You cannot transfer ownership to yourself.",
        });
      }

      // Scoped by organization so a member id from another org is indistinguishable from a missing one.
      const [target] = await context.db
        .select()
        .from(schema.member)
        .where(
          and(
            eq(schema.member.id, input.targetMemberId),
            eq(schema.member.organizationId, context.org.id),
          ),
        );
      if (!target) {
        throw new ORPCError("NOT_FOUND", {
          message: "Target is not a member of this organization.",
        });
      }

      // R8.3: an existing owner gains no additional owned org, so the limit does not apply to them.
      // Fast path only: the authoritative check re-runs under the row lock below.
      if (
        !hasOwnerRole(target.role) &&
        (await hasReachedOwnedOrgLimit(
          context.db,
          target.userId,
          context.defaultMaxOrganizationsPerUser,
        ))
      ) {
        throw targetLimitError();
      }

      // The role swap commits atomically; roles are set exactly (spec §6.5 "set role"), not merged.
      const changes = await context.db.transaction(async (tx) => {
        // Serialize per target user across organizations: the owned-org count below spans orgs, so
        // member-row locks alone cannot stop two transfers (different orgs, same target) from both
        // passing it. A plain `FOR UPDATE` on the user row is enough with Drizzle and always taken
        // before the member rows, so lock order is consistent. Scope: transfer-vs-transfer only;
        // better-auth's org create (`organizationLimit`) and `beforeUpdateMemberRole` do not take it.
        await tx
          .select({ id: schema.user.id })
          .from(schema.user)
          .where(eq(schema.user.id, target.userId))
          .for("update");
        const rows = await tx
          .select()
          .from(schema.member)
          .where(inArray(schema.member.id, [target.id, context.member.id]))
          .for("update");
        const current = new Map(rows.map((row) => [row.id, row]));
        const caller = current.get(context.member.id);
        const lockedTarget = current.get(target.id);
        // Re-check under the row lock: roles may have changed since the reads above.
        if (!caller || !hasOwnerRole(caller.role) || !lockedTarget) {
          throw new ORPCError("CONFLICT", { message: "Membership changed; retry." });
        }
        // Authoritative R8.3 check: the target's current role and the limit are evaluated under
        // the lock (the pre-lock check above can be stale).
        if (
          !hasOwnerRole(lockedTarget.role) &&
          (await hasReachedOwnedOrgLimit(
            tx,
            lockedTarget.userId,
            context.defaultMaxOrganizationsPerUser,
          ))
        ) {
          throw targetLimitError();
        }

        const planned = [
          ...(hasOwnerRole(lockedTarget.role)
            ? []
            : [{ row: lockedTarget, newRole: "owner" as const }]),
          { row: caller, newRole: "admin" as const },
        ];
        for (const { row, newRole } of planned) {
          await tx.update(schema.member).set({ role: newRole }).where(eq(schema.member.id, row.id));
        }
        return planned.map(({ row, newRole }) => ({
          memberId: row.id,
          memberUserId: row.userId,
          previousRole: row.role,
          newRole,
        }));
      });

      // Audit write policy (R7.2, docs/architecture/audit-log.md#failure-policy): same as the
      // better-auth hooks, the row is written after the mutation commits and a failed write
      // fails the request (the transfer is not rolled back). The logger is bound to the pool, not `tx`.
      // Consequence: if a write throws, the caller gets an error although the roles already changed
      // (and the second `member.role_changed` row may be missing); retrying then sees the target as owner.
      const [org] = await context.db
        .select({ name: schema.organization.name })
        .from(schema.organization)
        .where(eq(schema.organization.id, context.org.id));
      for (const change of changes) {
        await context.auditLogger.record({
          scope: "organization",
          organizationId: context.org.id,
          actorUserId: context.session.user.id,
          action: "member.role_changed",
          targetType: "member",
          targetId: change.memberId,
          metadata: {
            organizationName: org?.name,
            memberUserId: change.memberUserId,
            previousRole: change.previousRole,
            newRole: change.newRole,
          },
        });
      }

      return { organizationId: context.org.id, newOwnerMemberId: target.id };
    }),
};
