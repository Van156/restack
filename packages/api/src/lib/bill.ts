import { computeBill, suggestedTip } from "@base-template/db/lib/bill";
import { orderLineUnitTotal } from "@base-template/db/lib/order-line";
import * as schema from "@base-template/db/schema";
import type { BillStatus, PaymentTender } from "@base-template/db/schema/restaurant-billing";
import { and, asc, eq, isNull } from "drizzle-orm";

import type { DbExecutor } from "./executor";

export type BillPayment = {
  id: string;
  tender: PaymentTender;
  amount: number;
  tendered: number | null;
  /** Cash handed back: `tendered - amount`; zero for other tenders. */
  change: number;
  reference: string | null;
  registeredOffline: boolean;
  recordedByMemberId: string | null;
  clientRecordedAt: Date | null;
  recordedAt: Date;
};

/** What the cashier sees: priced lines, tax, tip, payments and what is still owed. */
export type BillView = {
  tableSessionId: string;
  locationId: string;
  /** `null` until the first tip or payment creates the Bill row. */
  billId: string | null;
  status: BillStatus;
  lines: {
    id: string;
    itemName: string;
    quantity: number;
    note: string | null;
    modifiers: (typeof schema.orderLine.$inferSelect)["modifiers"];
    unitTotal: number;
    gross: number;
    discount: number;
    total: number;
    base: number;
    tax: number;
    taxClass: (typeof schema.orderLine.$inferSelect)["taxClass"];
  }[];
  subtotal: number;
  discountTotal: number;
  total: number;
  base: number;
  tax: number;
  taxByClass: ReturnType<typeof computeBill>["taxByClass"];
  tip: number;
  suggestedTip: { percent: number; amount: number };
  /** Total plus tip. */
  payable: number;
  paid: number;
  /** `payable - paid`; negative when payments exceed what is now owed. */
  balanceDue: number;
  payments: BillPayment[];
  settledAt: Date | null;
};

/**
 * When a Bill settles: the server clock, unless a payment carries the device time of an offline
 * sale. Then the sale time (latest payment by device time) wins, never later than `now`, so
 * reports and the DIAN document keep the original day. See docs/architecture/restaurant.md#sync.
 */
export function settleTimeOf(payments: BillView["payments"], now: Date): Date {
  if (!payments.some((payment) => payment.clientRecordedAt)) {
    return now;
  }
  const latest = Math.max(
    ...payments.map((payment) => (payment.clientRecordedAt ?? payment.recordedAt).getTime()),
  );
  return new Date(Math.min(latest, now.getTime()));
}

type SessionRef = { id: string; locationId: string };

/** The Bill row of a Table session, if one exists. */
export async function findBill(db: DbExecutor, tableSessionId: string) {
  const [row] = await db
    .select()
    .from(schema.bill)
    .where(eq(schema.bill.tableSessionId, tableSessionId));
  return row;
}

/** The Bill row of a Table session, created on first use (safe under concurrent callers). */
export async function ensureBill(db: DbExecutor, session: SessionRef & { organizationId: string }) {
  await db
    .insert(schema.bill)
    .values({
      organizationId: session.organizationId,
      locationId: session.locationId,
      tableSessionId: session.id,
    })
    .onConflictDoNothing();
  return (await findBill(db, session.id))!;
}

/** Takes the Bill row lock (`FOR UPDATE`); serializes payments, settling and tip changes on one Bill. */
export async function lockBill(db: DbExecutor, billId: string): Promise<void> {
  await db
    .select({ id: schema.bill.id })
    .from(schema.bill)
    .where(eq(schema.bill.id, billId))
    .for("update");
}

/** Computes the Bill of a Table session from its unvoided lines, discounts, tip and payments. */
export async function loadBillView(
  db: DbExecutor,
  session: SessionRef,
  suggestedTipPercent: number,
): Promise<BillView> {
  const lineRows = await db
    .select({ line: schema.orderLine })
    .from(schema.orderLine)
    .leftJoin(schema.orderLineVoid, eq(schema.orderLineVoid.orderLineId, schema.orderLine.id))
    .where(and(eq(schema.orderLine.tableSessionId, session.id), isNull(schema.orderLineVoid.id)))
    .orderBy(asc(schema.orderLine.recordedAt), asc(schema.orderLine.createdAt));
  const discounts = await db
    .select()
    .from(schema.discount)
    .where(eq(schema.discount.tableSessionId, session.id))
    .orderBy(asc(schema.discount.recordedAt), asc(schema.discount.createdAt));
  const billRow = await findBill(db, session.id);
  const paymentRows = billRow
    ? await db
        .select()
        .from(schema.payment)
        .where(eq(schema.payment.billId, billRow.id))
        .orderBy(asc(schema.payment.recordedAt), asc(schema.payment.createdAt))
    : [];

  const lines = lineRows.map((row) => row.line);
  const computed = computeBill(lines, discounts);
  const tip = billRow?.tipAmount ?? 0;
  const payable = computed.total + tip;
  const paid = paymentRows.reduce((sum, row) => sum + row.amount, 0);

  return {
    tableSessionId: session.id,
    locationId: session.locationId,
    billId: billRow?.id ?? null,
    status: billRow?.status ?? "open",
    lines: computed.lines.map((entry, index) => {
      const line = lines[index]!;
      return {
        id: line.id,
        itemName: line.itemName,
        quantity: line.quantity,
        note: line.note,
        modifiers: line.modifiers,
        unitTotal: orderLineUnitTotal(line),
        gross: entry.gross,
        discount: entry.discount,
        total: entry.total,
        base: entry.base,
        tax: entry.tax,
        taxClass: entry.taxClass,
      };
    }),
    subtotal: computed.subtotal,
    discountTotal: computed.discountTotal,
    total: computed.total,
    base: computed.base,
    tax: computed.tax,
    taxByClass: computed.taxByClass,
    tip,
    suggestedTip: {
      percent: suggestedTipPercent,
      amount: suggestedTip(computed.total, suggestedTipPercent),
    },
    payable,
    paid,
    balanceDue: payable - paid,
    payments: paymentRows.map((row) => ({
      id: row.id,
      tender: row.tender,
      amount: row.amount,
      tendered: row.tendered,
      change: row.tendered === null ? 0 : row.tendered - row.amount,
      reference: row.reference,
      registeredOffline: row.registeredOffline,
      recordedByMemberId: row.recordedByMemberId,
      clientRecordedAt: row.clientRecordedAt,
      recordedAt: row.recordedAt,
    })),
    settledAt: billRow?.settledAt ?? null,
  };
}
