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

export type MarginSummary = {
  revenue: number;
  /** Revenue of lines whose Menu item has a cost. */
  costedRevenue: number;
  /** Revenue of lines without a cost: flagged, never treated as zero cost. */
  uncostedRevenue: number;
  cost: number;
  /** `costedRevenue - cost`; null when no line has a cost. */
  margin: number | null;
  marginIncomplete: boolean;
};

/** Cost and margin over lines; lines without a cost stay out of the margin and raise the flag. */
export function summarizeMargin(lines: readonly ReportLine[]): MarginSummary {
  let costedRevenue = 0;
  let uncostedRevenue = 0;
  let cost = 0;
  let costedLines = 0;
  for (const entry of lines) {
    if (entry.unitCost === null) {
      uncostedRevenue += entry.revenue;
      continue;
    }
    costedRevenue += entry.revenue;
    cost += entry.unitCost * entry.quantity;
    costedLines += 1;
  }
  return {
    revenue: costedRevenue + uncostedRevenue,
    costedRevenue,
    uncostedRevenue,
    cost,
    margin: costedLines === 0 ? null : costedRevenue - cost,
    marginIncomplete: lines.length > costedLines,
  };
}

export type ItemSummary = {
  menuItemId: string | null;
  itemName: string;
  quantity: number;
  revenue: number;
  cost: number | null;
  margin: number | null;
  costMissing: boolean;
};

/** Sold quantity, revenue, cost and margin per Menu item, best revenue first. */
export function summarizeByItem(bills: readonly ReportBill[]): ItemSummary[] {
  const groups = new Map<
    string,
    { menuItemId: string | null; itemName: string; lines: ReportLine[] }
  >();
  for (const bill of bills) {
    for (const entry of bill.lines) {
      const key = entry.menuItemId ?? `name:${entry.itemName}`;
      const group = groups.get(key) ?? {
        menuItemId: entry.menuItemId,
        itemName: entry.itemName,
        lines: [],
      };
      group.lines.push(entry);
      groups.set(key, group);
    }
  }
  return [...groups.values()]
    .map((group) => {
      const margin = summarizeMargin(group.lines);
      return {
        menuItemId: group.menuItemId,
        itemName: group.itemName,
        quantity: group.lines.reduce((sum, entry) => sum + entry.quantity, 0),
        revenue: margin.revenue,
        cost: margin.marginIncomplete ? null : margin.cost,
        margin: margin.marginIncomplete ? null : margin.margin,
        costMissing: margin.marginIncomplete,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || a.itemName.localeCompare(b.itemName));
}

export type StaffSummary = {
  memberId: string | null;
  billCount: number;
  salesTotal: number;
  tipTotal: number;
  margin: MarginSummary;
};

/** Sales, tips and margin per Staff member who settled the Bills, best sales first. */
export function summarizeByStaff(bills: readonly ReportBill[]): StaffSummary[] {
  const groups = new Map<string | null, ReportBill[]>();
  for (const bill of bills) {
    const list = groups.get(bill.settledByMemberId) ?? [];
    list.push(bill);
    groups.set(bill.settledByMemberId, list);
  }
  return [...groups]
    .map(([memberId, list]) => ({
      memberId,
      billCount: list.length,
      salesTotal: list.reduce((sum, bill) => sum + bill.total, 0),
      tipTotal: list.reduce((sum, bill) => sum + bill.tip, 0),
      margin: summarizeMargin(list.flatMap((bill) => bill.lines)),
    }))
    .sort(
      (a, b) => b.salesTotal - a.salesTotal || (a.memberId ?? "").localeCompare(b.memberId ?? ""),
    );
}
