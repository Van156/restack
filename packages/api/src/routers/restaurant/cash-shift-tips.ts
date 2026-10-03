import { parseRoles } from "@base-template/auth/role-names";
import { businessDayBounds } from "@base-template/db/lib/business-day";
import { splitTips } from "@base-template/db/lib/tip-split";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { recordAuditThrough } from "../../lib/audit-in-transaction";
import { shiftTipTotal } from "../../lib/cash-shift";
import { assertLocationAccess } from "../../lib/location-scope";
import { loadShiftInScope } from "./cash-shift-shared";

const MAX_BENEFICIARIES = 50;
const EXCLUDED_ROLES = ["owner", "admin"];
const manageShift = requirePermission({ cashShift: ["manage"] });
const shiftInput = z.object({ cashShiftId: z.string().min(1) });
const businessDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const beneficiaryInput = z.object({
  memberId: z.string().min(1).optional(),
  displayName: z.string().trim().min(1).max(100).optional(),
  sharePercent: z.number().int().min(1).max(100).optional(),
});

const isExcluded = (role: string) => parseRoles(role).some((name) => EXCLUDED_ROLES.includes(name));

export const cashShiftTipsRouter = {
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
        .filter((row) => !isExcluded(row.role))
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
        if (isExcluded(row.role)) {
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

  /**
   * Distributes a closed shift's tips among its beneficiaries and audits `tip.distributed`. Done
   * once: repeating returns the stored rows. See docs/architecture/restaurant.md#tip-distribution.
   */
  distributeTips: orgProcedure
    .use(manageShift)
    .input(shiftInput)
    .handler(async ({ context, input }) => {
      const found = await loadShiftInScope(context, input.cashShiftId);
      return context.db.transaction(async (tx) => {
        const [shift] = await tx
          .select()
          .from(schema.cashShift)
          .where(eq(schema.cashShift.id, found.id))
          .for("update");
        if (!shift?.closedAt) {
          throw new ORPCError("CONFLICT", {
            message: "Tips are distributed after the shift closes.",
          });
        }
        const beneficiaries = await tx
          .select()
          .from(schema.tipBeneficiary)
          .where(eq(schema.tipBeneficiary.cashShiftId, shift.id))
          .orderBy(asc(schema.tipBeneficiary.position));
        const inListOrder = <T extends { beneficiaryId: string }>(rows: T[]) =>
          rows.sort(
            (a, b) =>
              beneficiaries.findIndex((x) => x.id === a.beneficiaryId) -
              beneficiaries.findIndex((x) => x.id === b.beneficiaryId),
          );
        const existing = await tx
          .select()
          .from(schema.tipDistribution)
          .where(eq(schema.tipDistribution.cashShiftId, shift.id));
        if (existing.length > 0) {
          return inListOrder(existing);
        }
        if (beneficiaries.length === 0) {
          throw new ORPCError("PRECONDITION_FAILED", {
            message: "Configure the Tip beneficiaries first.",
          });
        }
        const total = await shiftTipTotal(tx, shift.id);
        const amounts = splitTips(total, beneficiaries);
        const rows = await tx
          .insert(schema.tipDistribution)
          .values(
            beneficiaries.map((beneficiary, index) => ({
              organizationId: context.org.id,
              cashShiftId: shift.id,
              beneficiaryId: beneficiary.id,
              memberId: beneficiary.memberId,
              displayName: beneficiary.displayName,
              amount: amounts[index]!,
            })),
          )
          .returning();
        await recordAuditThrough(tx, {
          scope: "organization",
          organizationId: context.org.id,
          actorUserId: context.session.user.id,
          action: "tip.distributed",
          targetType: "cash_shift",
          targetId: shift.id,
          metadata: {
            locationId: shift.locationId,
            total,
            shares: rows.map((row) => ({
              beneficiaryId: row.beneficiaryId,
              displayName: row.displayName,
              amount: row.amount,
            })),
          },
        });
        return inListOrder(rows);
      });
    }),

  /**
   * Tip distribution report of a Location: one shift, or every distributed shift closed in a period
   * of Bogota business days (`from` and `to` inclusive). Each person is summed across the shifts.
   */
  tipDistributionReport: orgProcedure
    .use(manageShift)
    .input(
      z
        .object({
          locationId: z.string().min(1),
          cashShiftId: z.string().min(1).optional(),
          from: businessDate.optional(),
          to: businessDate.optional(),
        })
        .refine(
          (input) =>
            input.cashShiftId !== undefined
              ? input.from === undefined && input.to === undefined
              : input.from !== undefined && input.to !== undefined,
          { message: "Give a cash shift or a from and to period." },
        ),
    )
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      const scope = and(
        eq(schema.cashShift.organizationId, context.org.id),
        eq(schema.cashShift.locationId, input.locationId),
      );
      let periodFilter;
      try {
        periodFilter =
          input.cashShiftId !== undefined
            ? eq(schema.cashShift.id, input.cashShiftId)
            : and(
                gte(schema.cashShift.closedAt, businessDayBounds(input.from!).start),
                lt(schema.cashShift.closedAt, businessDayBounds(input.to!).end),
              );
      } catch (error) {
        throw new ORPCError("BAD_REQUEST", {
          message: error instanceof Error ? error.message : "Invalid period.",
        });
      }
      const shifts = await context.db
        .select()
        .from(schema.cashShift)
        .where(and(scope, periodFilter))
        .orderBy(asc(schema.cashShift.closedAt), asc(schema.cashShift.id));
      if (input.cashShiftId !== undefined && shifts.length === 0) {
        throw new ORPCError("NOT_FOUND", { message: "Cash shift not found." });
      }
      const distributions =
        shifts.length === 0
          ? []
          : await context.db
              .select()
              .from(schema.tipDistribution)
              .where(
                inArray(
                  schema.tipDistribution.cashShiftId,
                  shifts.map((shift) => shift.id),
                ),
              );

      const reported = shifts.map((shift) => {
        const rows = distributions.filter((row) => row.cashShiftId === shift.id);
        return {
          cashShiftId: shift.id,
          closedAt: shift.closedAt,
          distributed: rows.length > 0,
          tipTotal: rows.reduce((sum, row) => sum + row.amount, 0),
          shares: rows.map((row) => ({
            memberId: row.memberId,
            displayName: row.displayName,
            amount: row.amount,
          })),
        };
      });
      const people = new Map<
        string,
        { memberId: string | null; displayName: string; amount: number }
      >();
      for (const row of distributions) {
        const key = row.memberId ?? `name:${row.displayName}`;
        const person = people.get(key) ?? {
          memberId: row.memberId,
          displayName: row.displayName,
          amount: 0,
        };
        person.amount += row.amount;
        people.set(key, person);
      }
      return {
        shifts: reported.filter((shift) => shift.distributed),
        people: [...people.values()].sort(
          (a, b) => b.amount - a.amount || a.displayName.localeCompare(b.displayName),
        ),
      };
    }),
};
