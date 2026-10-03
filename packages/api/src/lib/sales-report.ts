import type { PaymentTender } from "@base-template/db/schema/restaurant-billing";
import { PAYMENT_TENDERS } from "@base-template/db/schema/restaurant-billing";

/** A settled Bill as the reports read it: recorded amounts only, never recomputed from the menu. */
export type ReportBill = {
  id: string;
  locationId: string;
  settledByMemberId: string | null;
  /** Sales total (tax inclusive, discounts applied, tip excluded). */
  total: number;
  tip: number;
  payments: { tender: PaymentTender; amount: number }[];
  lines: ReportLine[];
};

export type ReportLine = {
  menuItemId: string | null;
  itemName: string;
  quantity: number;
  /** Line total after its share of the Bill discount. */
  revenue: number;
  /** Current cost per unit of the Menu item; null when it has none or the item was deleted. */
  unitCost: number | null;
};

export type TenderSummary = {
  billCount: number;
  salesTotal: number;
  tipTotal: number;
  /** Everything collected: sales plus tips, by payment. */
  collectedTotal: number;
  tenders: Record<PaymentTender, { count: number; amount: number }>;
};

/** Totals by tender over settled Bills; tips are reported apart from sales. */
export function summarizeTenders(bills: readonly ReportBill[]): TenderSummary {
  const tenders = Object.fromEntries(
    PAYMENT_TENDERS.map((tender) => [tender, { count: 0, amount: 0 }]),
  ) as TenderSummary["tenders"];
  let salesTotal = 0;
  let tipTotal = 0;
  for (const bill of bills) {
    salesTotal += bill.total;
    tipTotal += bill.tip;
    for (const payment of bill.payments) {
      tenders[payment.tender].count += 1;
      tenders[payment.tender].amount += payment.amount;
    }
  }
  return {
    billCount: bills.length,
    salesTotal,
    tipTotal,
    collectedTotal: PAYMENT_TENDERS.reduce((sum, tender) => sum + tenders[tender].amount, 0),
    tenders,
  };
}
