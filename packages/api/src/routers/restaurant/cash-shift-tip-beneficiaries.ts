import { splitTips } from "@base-template/db/lib/tip-split";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { assertLocationAccess } from "../../lib/location-scope";
import { isTipExcludedRole } from "../../lib/tip-distribution";
import { loadShiftInScope } from "./cash-shift-shared";

const MAX_BENEFICIARIES = 50;
const manageShift = requirePermission({ cashShift: ["manage"] });
const shiftInput = z.object({ cashShiftId: z.string().min(1) });

const beneficiaryInput = z.object({
  memberId: z.string().min(1).optional(),
  displayName: z.string().trim().min(1).max(100).optional(),
  sharePercent: z.number().int().min(1).max(100).optional(),
});

export const cashShiftTipBeneficiariesRouter = {
  /** Staff assigned to the Location who may share tips: everyone except the Owner and Administrators. */
  tipCandidates: orgProcedure
    .use(manageShift)
    .input(z.object({ locationId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      const rows = await context.db
        .select({
          memberId: schema.member.id,
          role: schema.member.role,
          displayName: schema.user.name,
        })
        .from(schema.staffLocationAssignment)
        .innerJoin(schema.member, eq(schema.member.id, schema.staffLocationAssignment.memberId))
        .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
        .where(
          and(
            eq(schema.staffLocationAssignment.locationId, input.locationId),
            eq(schema.staffLocationAssignment.organizationId, context.org.id),
          ),
        )
        .orderBy(asc(schema.user.name), asc(schema.member.id));
      return rows
        .filter((row) => !isTipExcludedRole(row.role))
        .map(({ memberId, displayName }) => ({ memberId, displayName }));
    }),

  /**
   * Replaces the shift's Tip beneficiaries (Owner and Administrators configure). Members must be
   * assigned to the Location and never hold the Owner or Administrator Role; others are added by name.
   * Percents are on every entry and sum to 100, or on none for an equal split. Frozen once distributed.
   */
  setTipBeneficiaries: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(
      shiftInput.extend({
        beneficiaries: z.array(beneficiaryInput).min(1).max(MAX_BENEFICIARIES),
      }),
    )
    .handler(async ({ context, input }) => {
      const shift = await loadShiftInScope(context, input.cashShiftId);
      const bad = (message: string) => new ORPCError("BAD_REQUEST", { message });

      const memberIds = input.beneficiaries.flatMap((entry) =>
        entry.memberId ? [entry.memberId] : [],
      );
      if (new Set(memberIds).size !== memberIds.length) {
        throw bad("A member can be listed only once.");
      }
      for (const entry of input.beneficiaries) {
        if (Boolean(entry.memberId) === Boolean(entry.displayName)) {
          throw bad("Each beneficiary is either a member or a name.");
        }
      }
      try {
        splitTips(0, input.beneficiaries);
      } catch (error) {
        throw bad(error instanceof Error ? error.message : "Invalid shares.");
      }

      const members =
        memberIds.length === 0
          ? []
          : await context.db
              .select({
                id: schema.member.id,
                role: schema.member.role,
                name: schema.user.name,
              })
              .from(schema.member)
              .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
              .innerJoin(
                schema.staffLocationAssignment,
                and(
                  eq(schema.staffLocationAssignment.memberId, schema.member.id),
                  eq(schema.staffLocationAssignment.locationId, shift.locationId),
                ),
              )
              .where(
                and(
                  inArray(schema.member.id, memberIds),
                  eq(schema.member.organizationId, context.org.id),
                ),
              );
      const byId = new Map(members.map((row) => [row.id, row]));
      for (const memberId of memberIds) {
        const row = byId.get(memberId);
        if (!row) {
          throw bad("A beneficiary is not Staff of this Location.");
        }
        if (isTipExcludedRole(row.role)) {
          throw bad("The Owner and Administrators cannot receive tips.");
        }
      }

      return context.db.transaction(async (tx) => {
        await tx
          .select({ id: schema.cashShift.id })
          .from(schema.cashShift)
          .where(eq(schema.cashShift.id, shift.id))
          .for("update");
        const [distributed] = await tx
          .select({ id: schema.tipDistribution.id })
          .from(schema.tipDistribution)
          .where(eq(schema.tipDistribution.cashShiftId, shift.id))
          .limit(1);
        if (distributed) {
          throw new ORPCError("CONFLICT", {
            message: "The tips of this shift were already distributed.",
          });
        }
        await tx
          .delete(schema.tipBeneficiary)
          .where(eq(schema.tipBeneficiary.cashShiftId, shift.id));
        return tx
          .insert(schema.tipBeneficiary)
          .values(
            input.beneficiaries.map((entry, position) => ({
              organizationId: context.org.id,
              cashShiftId: shift.id,
              memberId: entry.memberId ?? null,
              displayName: entry.memberId ? byId.get(entry.memberId)!.name : entry.displayName!,
              sharePercent: entry.sharePercent ?? null,
              position,
            })),
          )
          .returning();
      });
    }),

  /** The shift's Tip beneficiaries in list order. */
  tipBeneficiaries: orgProcedure
    .use(manageShift)
    .input(shiftInput)
    .handler(async ({ context, input }) => {
      const shift = await loadShiftInScope(context, input.cashShiftId);
      return context.db
        .select()
        .from(schema.tipBeneficiary)
        .where(eq(schema.tipBeneficiary.cashShiftId, shift.id))
        .orderBy(asc(schema.tipBeneficiary.position));
    }),
};
