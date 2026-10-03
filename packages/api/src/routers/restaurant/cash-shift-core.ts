import * as schema from "@base-template/db/schema";
import { PAYMENT_TENDERS } from "@base-template/db/schema/restaurant-billing";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { recordAuditThrough } from "../../lib/audit-in-transaction";
import { computeShiftLedger, findOpenShift } from "../../lib/cash-shift";
import { assertLocationAccess } from "../../lib/location-scope";
import { consumeOverride } from "../../lib/override";
import { distributeShiftTips } from "../../lib/tip-distribution";
import { loadShiftInScope } from "./cash-shift-shared";
import { orConflict } from "./setup-helpers";

const amount = z.number().int().min(0).max(1_000_000_000);
const shiftInput = z.object({ cashShiftId: z.string().min(1) });
const manageShift = requirePermission({ cashShift: ["manage"] });

export const cashShiftCoreRouter = {
  /**
   * Opens the Location's Cash shift (a second open is CONFLICT) and attaches the Location's
   * shiftless payments to it.
   */
  open: orgProcedure
    .use(manageShift)
    .input(z.object({ locationId: z.string().min(1), openingAmount: amount }))
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      return context.db.transaction(async (tx) => {
        const [shift] = await orConflict("This Location already has an open Cash shift.", () =>
          tx
            .insert(schema.cashShift)
            .values({
              organizationId: context.org.id,
              locationId: input.locationId,
              openedByMemberId: context.member.id,
              openedAt: context.clock.now(),
              openingAmount: input.openingAmount,
            })
            .returning(),
        );
        // Payments taken while no shift was open belong to the next one.
        const attached = await tx
          .update(schema.payment)
          .set({ cashShiftId: shift!.id })
          .where(
            and(
              eq(schema.payment.locationId, input.locationId),
              isNull(schema.payment.cashShiftId),
            ),
          )
          .returning({ id: schema.payment.id });
        await recordAuditThrough(tx, {
          scope: "organization",
          organizationId: context.org.id,
          actorUserId: context.session.user.id,
          action: "cash_shift.opened",
          targetType: "cash_shift",
          targetId: shift!.id,
          metadata: {
            locationId: input.locationId,
            openingAmount: input.openingAmount,
            attachedPayments: attached.length,
          },
        });
        return shift!;
      });
    }),

  /** The Location's open Cash shift, or null. */
  current: orgProcedure
    .use(manageShift)
    .input(z.object({ locationId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      return (await findOpenShift(context.db, input.locationId)) ?? null;
    }),

  /** The ledger of a shift (open or closed): takings by tender, tips, change given, expected amounts. */
  ledger: orgProcedure
    .use(manageShift)
    .input(shiftInput)
    .handler(async ({ context, input }) =>
      computeShiftLedger(context.db, await loadShiftInScope(context, input.cashShiftId)),
    ),

  /**
   * Closes a shift with the counted amounts per tender. Any tender off its expected amount needs an
   * Override (`close_shift_difference`, target the shift id), spent in the same transaction. The
   * shift's tip distribution is stored in that same transaction.
   */
  close: orgProcedure
    .use(manageShift)
    .input(
      shiftInput.extend({
        counted: z.object({ cash: amount, card: amount, qr_transfer: amount }),
        overrideId: z.string().min(1).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const found = await loadShiftInScope(context, input.cashShiftId);

      return context.db.transaction(async (tx) => {
        // Blocks payments joining the shift (they take a shared lock) while its ledger is read.
        const [locked] = await tx
          .select()
          .from(schema.cashShift)
          .where(eq(schema.cashShift.id, found.id))
          .for("update");
        if (!locked || locked.closedAt) {
          throw new ORPCError("CONFLICT", { message: "This Cash shift is already closed." });
        }
        const { expected } = await computeShiftLedger(tx, locked);
        const counted = input.counted;
        const counts = counted.cash + counted.card + counted.qr_transfer;
        const difference = counts - expected.total;
        const hasDifference = PAYMENT_TENDERS.some(
          (tender) => counted[tender] !== expected[tender],
        );

        let approverMemberId: string | null = null;
        if (hasDifference) {
          if (!input.overrideId) {
            throw new ORPCError("FORBIDDEN", {
              message: "Closing with a difference needs an Override.",
            });
          }
          ({ approverMemberId } = await consumeOverride(
            { db: tx, clock: context.clock },
            {
              organizationId: context.org.id,
              actorUserId: context.session.user.id,
              overrideId: input.overrideId,
              locationId: locked.locationId,
              action: "close_shift_difference",
              target: locked.id,
            },
          ));
        }

        const [closed] = await tx
          .update(schema.cashShift)
          .set({
            closedAt: context.clock.now(),
            closedByMemberId: context.member.id,
            expected: expected.total,
            counted: counts,
            difference,
            countedByTender: counted,
            overrideId: hasDifference ? input.overrideId : null,
          })
          .where(eq(schema.cashShift.id, locked.id))
          .returning();
        await recordAuditThrough(tx, {
          scope: "organization",
          organizationId: context.org.id,
          actorUserId: context.session.user.id,
          action: hasDifference ? "cash_shift.closed_with_difference" : "cash_shift.closed",
          targetType: "cash_shift",
          targetId: locked.id,
          metadata: {
            locationId: locked.locationId,
            expected: expected.total,
            counted: counts,
            difference,
            countedByTender: counted,
            ...(hasDifference ? { overrideId: input.overrideId, approverMemberId } : {}),
          },
        });
        await distributeShiftTips(tx, { shift: closed!, actorUserId: context.session.user.id });
        return closed!;
      });
    }),

  /** Payments of the shift flagged "registrado sin conexión", for review at close. */
  offlineTakings: orgProcedure
    .use(manageShift)
    .input(shiftInput)
    .handler(async ({ context, input }) => {
      const shift = await loadShiftInScope(context, input.cashShiftId);
      return context.db
        .select()
        .from(schema.payment)
        .where(
          and(eq(schema.payment.cashShiftId, shift.id), eq(schema.payment.registeredOffline, true)),
        )
        .orderBy(asc(schema.payment.recordedAt), asc(schema.payment.id));
    }),
};
