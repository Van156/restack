import * as schema from "@base-template/db/schema";
import { PAYMENT_TENDERS } from "@base-template/db/schema/restaurant-billing";
import type { PaymentTender } from "@base-template/db/schema/restaurant-billing";
import { and, eq, inArray, isNull } from "drizzle-orm";

import type { DbExecutor } from "./executor";

export type CashShiftRow = typeof schema.cashShift.$inferSelect;
export type TenderTotals = Record<PaymentTender, number>;

export type ShiftLedger = {
  shift: CashShiftRow;
  /** Takings by tender; cash `amount` is what the payments covered (change already handed back). */
  takings: Record<PaymentTender, { amount: number; count: number }>;
  /** Tips of the Bills whose last payment fell in this shift (see `shiftTipTotal`). */
  tips: number;
  /** Cash handed back to customers: tendered minus covered, summed over cash payments. */
  changeGiven: number;
  /** What the drawer and terminals should hold: opening cash plus cash takings, and the other tenders. */
  expected: TenderTotals & { total: number };
};

/** The Location's open Cash shift, or undefined. `lock` blocks a concurrent close (`update`) or lets payments coexist (`share`). */
export async function findOpenShift(
  db: DbExecutor,
  locationId: string,
  lock?: "share" | "update",
): Promise<CashShiftRow | undefined> {
  const query = db
    .select()
    .from(schema.cashShift)
    .where(and(eq(schema.cashShift.locationId, locationId), isNull(schema.cashShift.closedAt)));
  const [row] = lock ? await query.for(lock) : await query;
  return row;
}

/**
 * Tips of the shift: each Bill's tip counts once, in the shift of its latest payment (ties by
 * payment id), so a Bill paid across two shifts is not counted twice.
 * See docs/architecture/restaurant.md#cash-shift.
 */
export async function shiftTipTotal(db: DbExecutor, cashShiftId: string): Promise<number> {
  const inShift = await db
    .select({ billId: schema.payment.billId })
    .from(schema.payment)
    .where(eq(schema.payment.cashShiftId, cashShiftId));
  const billIds = [...new Set(inShift.map((row) => row.billId))];
  if (billIds.length === 0) {
    return 0;
  }
  const payments = await db
    .select({
      id: schema.payment.id,
      billId: schema.payment.billId,
      cashShiftId: schema.payment.cashShiftId,
      recordedAt: schema.payment.recordedAt,
    })
    .from(schema.payment)
    .where(inArray(schema.payment.billId, billIds));
  const lastByBill = new Map<string, (typeof payments)[number]>();
  for (const payment of payments) {
    const last = lastByBill.get(payment.billId);
    if (
      !last ||
      payment.recordedAt > last.recordedAt ||
      (payment.recordedAt.getTime() === last.recordedAt.getTime() && payment.id > last.id)
    ) {
      lastByBill.set(payment.billId, payment);
    }
  }
  const ownedBillIds = [...lastByBill.values()]
    .filter((payment) => payment.cashShiftId === cashShiftId)
    .map((payment) => payment.billId);
  if (ownedBillIds.length === 0) {
    return 0;
  }
  const bills = await db
    .select({ tipAmount: schema.bill.tipAmount })
    .from(schema.bill)
    .where(inArray(schema.bill.id, ownedBillIds));
  return bills.reduce((sum, bill) => sum + bill.tipAmount, 0);
}

/** The ledger of a shift: takings by tender, tips, change given and the expected amounts. */
export async function computeShiftLedger(
  db: DbExecutor,
  shift: CashShiftRow,
): Promise<ShiftLedger> {
  const payments = await db
    .select({
      tender: schema.payment.tender,
      amount: schema.payment.amount,
      tendered: schema.payment.tendered,
    })
    .from(schema.payment)
    .where(eq(schema.payment.cashShiftId, shift.id));

  const takings = Object.fromEntries(
    PAYMENT_TENDERS.map((tender) => [tender, { amount: 0, count: 0 }]),
  ) as ShiftLedger["takings"];
  let changeGiven = 0;
  for (const payment of payments) {
    takings[payment.tender].amount += payment.amount;
    takings[payment.tender].count += 1;
    if (payment.tendered !== null) {
      changeGiven += payment.tendered - payment.amount;
    }
  }
  const cash = shift.openingAmount + takings.cash.amount;
  return {
    shift,
    takings,
    tips: await shiftTipTotal(db, shift.id),
    changeGiven,
    expected: {
      cash,
      card: takings.card.amount,
      qr_transfer: takings.qr_transfer.amount,
      total: cash + takings.card.amount + takings.qr_transfer.amount,
    },
  };
}
