import * as schema from "@base-template/db/schema";
import { PAYMENT_TENDERS } from "@base-template/db/schema/restaurant-billing";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { ensureBill, loadBillView, lockBill, settleTimeOf } from "../../lib/bill";
import { recordAuditThrough } from "../../lib/audit-in-transaction";
import { findOpenShift } from "../../lib/cash-shift";
import { consumeOverride } from "../../lib/override";
import { hasOpenSessionAtTable } from "../../lib/table-session";
import { loadChargeableSession, resolveChargingMemberId } from "./billing-shared";
import { actingTokenInput, idempotencyKey } from "./orders-shared";
import type { OrderContext } from "./orders-shared";
import { orConflict } from "./setup-helpers";

export const paymentObject = z.object({
  tableSessionId: z.string().min(1),
  tender: z.enum(PAYMENT_TENDERS),
  /** What the payment covers of the Bill, in COP. */
  amount: z.number().int().min(1),
  /** Cash only: the amount handed over; the change is `tendered - amount`. */
  tendered: z.number().int().optional(),
  reference: z.string().trim().max(100).optional(),
  registeredOffline: z.boolean().optional(),
  /** Device time of the sale when it was recorded offline. */
  clientRecordedAt: z.coerce.date().optional(),
  idempotencyKey,
  actingToken: actingTokenInput,
});

/** Tender rules shared by the procedure and the sync record: cash change, references for card and QR. */
export function refinePayment(
  input: Pick<z.infer<typeof paymentObject>, "tender" | "amount" | "tendered" | "reference">,
  ctx: z.RefinementCtx,
) {
  if (input.tender === "cash") {
    if (input.tendered !== undefined && input.tendered < input.amount) {
      ctx.addIssue({
        code: "custom",
        path: ["tendered"],
        message: "The amount handed over cannot be less than the amount covered.",
      });
    }
    return;
  }
  if (input.tendered !== undefined) {
    ctx.addIssue({ code: "custom", path: ["tendered"], message: "Only cash records tendered." });
  }
  if (!input.reference) {
    ctx.addIssue({
      code: "custom",
      path: ["reference"],
      message: "Card and QR/transfer payments need a reference.",
    });
  }
}

const paymentInput = paymentObject.superRefine(refinePayment);
export type PaymentInput = z.infer<typeof paymentInput>;

const sessionInput = z.object({ tableSessionId: z.string().min(1), actingToken: actingTokenInput });

/** Records a payment on the Table session's Bill; idempotent per key, also after settling. */
export async function recordPaymentCore(context: OrderContext, input: PaymentInput) {
  const { session, location } = await loadChargeableSession(context, input.tableSessionId);
  const memberId = await resolveChargingMemberId(context, location, input.actingToken);

  const outcome = await context.db.transaction(async (tx) => {
    const bill = await ensureBill(tx, session);
    // Serializes concurrent payments on one Bill so none can overshoot the balance.
    await lockBill(tx, bill.id);

    const [replay] = await tx
      .select()
      .from(schema.payment)
      .where(
        and(
          eq(schema.payment.organizationId, context.org.id),
          eq(schema.payment.idempotencyKey, input.idempotencyKey),
        ),
      );
    if (replay) {
      if (replay.billId !== bill.id) {
        throw new ORPCError("CONFLICT", { message: "This idempotency key was already used." });
      }
      return { payment: replay, replayed: true };
    }

    const view = await loadBillView(tx, session, location.suggestedTipPercent);
    if (input.amount > view.balanceDue) {
      throw new ORPCError("CONFLICT", {
        message: `The payment exceeds what is due (${Math.max(view.balanceDue, 0)} COP).`,
      });
    }
    // Shared lock: a concurrent close waits for this payment, so it lands in the counted ledger.
    const openShift = await findOpenShift(tx, session.locationId, "share");
    const [payment] = await tx
      .insert(schema.payment)
      .values({
        organizationId: context.org.id,
        locationId: session.locationId,
        billId: bill.id,
        cashShiftId: openShift?.id ?? null,
        tender: input.tender,
        amount: input.amount,
        tendered: input.tender === "cash" ? (input.tendered ?? input.amount) : null,
        reference: input.reference || null,
        registeredOffline: input.registeredOffline ?? false,
        recordedByMemberId: memberId,
        clientRecordedAt: input.clientRecordedAt ?? null,
        recordedAt: context.clock.now(),
        idempotencyKey: input.idempotencyKey,
      })
      .returning();
    return { payment: payment!, replayed: false };
  });

  const payment = outcome.payment;
  return {
    payment,
    /** True when the key had already recorded this payment (a replay). */
    replayed: outcome.replayed,
    change: payment.tendered === null ? 0 : payment.tendered - payment.amount,
    bill: await loadBillView(context.db, session, location.suggestedTipPercent),
  };
}

/** Settles a fully paid Bill and its Table session; repeating it returns the settled Bill. */
export async function settleCore(context: OrderContext, input: z.infer<typeof sessionInput>) {
  const { session, location } = await loadChargeableSession(context, input.tableSessionId);
  const memberId = await resolveChargingMemberId(context, location, input.actingToken);

  return context.db.transaction(async (tx) => {
    const bill = await ensureBill(tx, session);
    await lockBill(tx, bill.id);
    const [locked] = await tx.select().from(schema.bill).where(eq(schema.bill.id, bill.id));
    const view = await loadBillView(tx, session, location.suggestedTipPercent);
    if (locked!.status === "settled") {
      return view;
    }
    if (view.lines.length === 0) {
      throw new ORPCError("CONFLICT", { message: "There is nothing to charge on this Bill." });
    }
    if (view.balanceDue !== 0) {
      throw new ORPCError("CONFLICT", {
        message: `The Bill is not fully paid (balance ${view.balanceDue} COP).`,
      });
    }
    const settledAt = settleTimeOf(view.payments, context.clock.now());
    await tx
      .update(schema.bill)
      .set({
        status: "settled",
        base: view.base,
        tax: view.tax,
        discountTotal: view.discountTotal,
        total: view.total,
        settledAt,
        settledByMemberId: memberId,
      })
      .where(eq(schema.bill.id, bill.id));
    await tx
      .update(schema.tableSession)
      .set({ status: "settled", settledAt })
      .where(eq(schema.tableSession.id, session.id));
    return { ...view, status: "settled" as const, settledAt };
  });
}

export const billPaymentsRouter = {
  /**
   * Records a payment by tender. Split payments are separate calls; each must fit what is still
   * due (total plus tip). Idempotent per key, also after the Bill settled. The payment joins the
   * Location's open Cash shift, or stays unattached when none is open (docs/architecture/restaurant.md#cash-shift).
   */
  recordPayment: orgProcedure
    .use(requirePermission({ billing: ["charge"] }))
    .input(paymentInput)
    .handler(({ context, input }) => recordPaymentCore(context, input)),

  /**
   * Settles a fully paid Bill: records the totals and settles the Table session, which frees the
   * Table. Repeating it returns the settled Bill.
   */
  settle: orgProcedure
    .use(requirePermission({ billing: ["charge"] }))
    .input(sessionInput)
    .handler(({ context, input }) => settleCore(context, input)),

  /**
   * Reopens a settled Bill. Always needs an Override (`reopen_bill`, target the Table session id)
   * spent in the same transaction; the session returns to `bill_requested`.
   */
  reopen: orgProcedure
    .use(requirePermission({ billing: ["charge"] }))
    .input(
      sessionInput.extend({
        overrideId: z.string().min(1),
        reason: z.string().trim().min(1).max(200).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { session, location } = await loadChargeableSession(context, input.tableSessionId);
      const memberId = await resolveChargingMemberId(context, location, input.actingToken);

      await context.db.transaction(async (tx) => {
        const [bill] = await tx
          .select()
          .from(schema.bill)
          .where(eq(schema.bill.tableSessionId, session.id))
          .for("update");
        if (!bill || bill.status !== "settled") {
          throw new ORPCError("CONFLICT", { message: "Only a settled Bill can be reopened." });
        }
        if (await hasOpenSessionAtTable(tx, session.tableId)) {
          throw new ORPCError("CONFLICT", { message: "The Table already has an open session." });
        }
        const { approverMemberId } = await consumeOverride(
          { db: tx, clock: context.clock },
          {
            organizationId: context.org.id,
            actorUserId: context.session.user.id,
            overrideId: input.overrideId,
            locationId: session.locationId,
            action: "reopen_bill",
            target: session.id,
          },
        );
        await tx
          .update(schema.bill)
          .set({
            status: "reopened",
            base: null,
            tax: null,
            discountTotal: null,
            total: null,
            settledAt: null,
            settledByMemberId: null,
            reopenedAt: context.clock.now(),
            reopenedByMemberId: memberId,
          })
          .where(eq(schema.bill.id, bill.id));
        await orConflict("The Table already has an open session.", () =>
          tx
            .update(schema.tableSession)
            .set({ status: "bill_requested", settledAt: null })
            .where(eq(schema.tableSession.id, session.id)),
        );
        await recordAuditThrough(tx, {
          scope: "organization",
          organizationId: context.org.id,
          actorUserId: context.session.user.id,
          action: "bill.reopened",
          targetType: "bill",
          targetId: bill.id,
          metadata: {
            tableSessionId: session.id,
            overrideId: input.overrideId,
            approverMemberId,
            reason: input.reason ?? null,
            recordedByMemberId: memberId,
          },
        });
      });

      return loadBillView(context.db, session, location.suggestedTipPercent);
    }),
};
