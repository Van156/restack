import { businessDayBounds } from "@base-template/db/lib/business-day";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { assertLocationAccess } from "../../lib/location-scope";
import { distributeShiftTips } from "../../lib/tip-distribution";
import { loadShiftInScope } from "./cash-shift-shared";

const manageShift = requirePermission({ cashShift: ["manage"] });
const shiftInput = z.object({ cashShiftId: z.string().min(1) });
const businessDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const cashShiftTipDistributionRouter = {
  /**
   * Returns the closed shift's tip distribution. `close` already stored it, so this only computes
   * one when nobody was eligible at close and beneficiaries were configured since; a stored
   * distribution is returned unchanged. See docs/architecture/restaurant.md#tip-distribution.
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
        const rows = await distributeShiftTips(tx, {
          shift,
          actorUserId: context.session.user.id,
        });
        if (rows.length === 0) {
          throw new ORPCError("PRECONDITION_FAILED", {
            message: "Configure the Tip beneficiaries first.",
          });
        }
        return rows;
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
