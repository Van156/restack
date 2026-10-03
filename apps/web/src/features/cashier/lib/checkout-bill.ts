import type { BillLedgerProps } from "@base-template/ui/components/bill-ledger";
import type { Tender } from "@base-template/ui/lib/bill-ledger";

import type { SessionRef } from "./session-ref";

export type TaxClass = "impoconsumo" | "iva19";

/** A payment as the checkout shows it: from the server, or still waiting in the offline queue. */
export type CheckoutPayment = {
  id: string;
  tender: Tender;
  amount: number;
  tendered: number | null;
  change: number;
  reference: string | null;
  registeredOffline: boolean;
  /** ISO time of the sale: the device time for a payment recorded offline. */
  saleTime: string;
  queued: boolean;
};

/** The Bill with plain JSON values only, so the last copy can be kept on the device. */
export type CheckoutBill = {
  tableSessionId: string;
  locationId: string;
  status: "open" | "settled" | "reopened";
  lines: {
    id: string;
    itemName: string;
    quantity: number;
    note: string | null;
    unitTotal: number;
    base: number;
    tax: number;
    total: number;
    taxClass: TaxClass;
  }[];
  discountTotal: number;
  total: number;
  tip: number;
  suggestedTip: { percent: number; amount: number };
  balanceDue: number;
  taxByClass: Record<TaxClass, { base: number; tax: number }>;
  payments: CheckoutPayment[];
  settledAt: string | null;
};

/** What `billing.getBill` returns, as far as the checkout reads it. */
export type BillSource = Omit<CheckoutBill, "payments" | "settledAt"> & {
  payments: {
    id: string;
    tender: Tender;
    amount: number;
    tendered: number | null;
    change: number;
    reference: string | null;
    registeredOffline: boolean;
    recordedAt: Date;
    clientRecordedAt: Date | null;
  }[];
  settledAt: Date | null;
};

export function toCheckoutBill(source: BillSource): CheckoutBill {
  return {
    tableSessionId: source.tableSessionId,
    locationId: source.locationId,
    status: source.status,
    lines: source.lines.map((line) => ({
      id: line.id,
      itemName: line.itemName,
      quantity: line.quantity,
      note: line.note,
      unitTotal: line.unitTotal,
      base: line.base,
      tax: line.tax,
      total: line.total,
      taxClass: line.taxClass,
    })),
    discountTotal: source.discountTotal,
    total: source.total,
    tip: source.tip,
    suggestedTip: source.suggestedTip,
    balanceDue: source.balanceDue,
    taxByClass: source.taxByClass,
    payments: source.payments.map((payment) => ({
      id: payment.id,
      tender: payment.tender,
      amount: payment.amount,
      tendered: payment.tendered,
      change: payment.change,
      reference: payment.reference,
      registeredOffline: payment.registeredOffline,
      saleTime: (payment.clientRecordedAt ?? payment.recordedAt).toISOString(),
      queued: false,
    })),
    settledAt: source.settledAt?.toISOString() ?? null,
  };
}

const TAX_LABEL: Record<TaxClass, string> = { impoconsumo: "Impoconsumo 8%", iva19: "IVA 19%" };

/** The `BillLedger` props of a Bill: tax itemized by class, the tip on its own row. */
export function ledgerProps(bill: CheckoutBill): Omit<BillLedgerProps, "className"> {
  return {
    lines: bill.lines.map((line) => ({
      id: line.id,
      quantity: line.quantity,
      name: line.itemName,
      base: line.base,
      tax: line.tax,
      total: line.total,
    })),
    taxes: (Object.keys(TAX_LABEL) as TaxClass[])
      .filter((taxClass) => bill.taxByClass[taxClass].tax > 0)
      .map((taxClass) => ({ label: TAX_LABEL[taxClass], amount: bill.taxByClass[taxClass].tax })),
    discountTotal: bill.discountTotal,
    total: bill.total,
    tip: bill.tip,
    payments: bill.payments.map((payment) => ({
      id: payment.id,
      tender: payment.tender,
      amount: payment.amount,
      change: payment.change,
      reference: payment.reference,
      registeredOffline: payment.registeredOffline,
    })),
    balanceDue: bill.balanceDue,
  };
}

type QueuedRecord = {
  idempotencyKey: string;
  kind: string;
  status: string;
  deviceRecordedAt: string;
  payload: Record<string, unknown>;
};

const PAYMENT_KINDS = new Set(["payment", "takings"]);
const COUNTING = new Set(["pending", "waiting", "failed"]);

/** Payments of this session still waiting in the queue (synced ones are already on the server). */
export function queuedPaymentsFor(
  records: readonly QueuedRecord[],
  session: SessionRef,
): CheckoutPayment[] {
  return records
    .filter((record) => {
      if (!PAYMENT_KINDS.has(record.kind) || !COUNTING.has(record.status)) {
        return false;
      }
      return "sessionId" in session
        ? record.payload.tableSessionId === session.sessionId
        : record.payload.sessionKey === session.sessionKey;
    })
    .map((record) => {
      const { tender, amount, tendered, reference } = record.payload as {
        tender: Tender;
        amount: number;
        tendered?: number;
        reference?: string;
      };
      return {
        id: record.idempotencyKey,
        tender,
        amount,
        tendered: tendered ?? null,
        change: tendered === undefined ? 0 : tendered - amount,
        reference: reference ?? null,
        registeredOffline: true,
        saleTime: record.deviceRecordedAt,
        queued: true,
      };
    });
}

/** The Bill with queued payments counted against the balance. */
export function withQueuedPayments(
  bill: CheckoutBill,
  queued: readonly CheckoutPayment[],
): CheckoutBill {
  if (queued.length === 0) {
    return bill;
  }
  const covered = queued.reduce((sum, payment) => sum + payment.amount, 0);
  return {
    ...bill,
    payments: [...bill.payments, ...queued],
    balanceDue: bill.balanceDue - covered,
  };
}

/** A Bill with lines and nothing left to pay can be settled. */
export function canSettle(bill: CheckoutBill): boolean {
  return bill.status !== "settled" && bill.lines.length > 0 && bill.balanceDue === 0;
}
