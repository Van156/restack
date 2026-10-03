/** Margin over the revenue that has a cost, as a whole percent; null when there is no margin. */
export function marginPercent(margin: number | null, costedRevenue: number): number | null {
  if (margin === null || costedRevenue <= 0) {
    return null;
  }
  return Math.round((margin / costedRevenue) * 100);
}

/** One row of `reports.byItem`. */
export type ItemSource = {
  menuItemId: string | null;
  itemName: string;
  quantity: number;
  revenue: number;
  cost: number | null;
  margin: number | null;
  costMissing: boolean;
};

export type ItemRow = {
  key: string;
  name: string;
  quantity: number;
  revenue: number;
  cost: number | null;
  margin: number | null;
  marginPercent: number | null;
  costMissing: boolean;
};

export function toItemRows(items: readonly ItemSource[]): ItemRow[] {
  return items.map((item) => ({
    key: item.menuItemId ?? `name:${item.itemName}`,
    name: item.itemName,
    quantity: item.quantity,
    revenue: item.revenue,
    cost: item.cost,
    margin: item.margin,
    marginPercent: marginPercent(item.margin, item.revenue),
    costMissing: item.costMissing,
  }));
}

/** The margin block the server computes over a set of lines. */
export type MarginSource = {
  revenue: number;
  costedRevenue: number;
  uncostedRevenue: number;
  cost: number;
  margin: number | null;
  marginIncomplete: boolean;
};

/** One row of `reports.byStaff`. */
export type StaffSource = {
  memberId: string | null;
  name: string | null;
  billCount: number;
  salesTotal: number;
  tipTotal: number;
  margin: MarginSource;
};

export type StaffRow = {
  key: string;
  name: string;
  billCount: number;
  salesTotal: number;
  tipTotal: number;
  cost: number;
  margin: number | null;
  marginPercent: number | null;
  marginIncomplete: boolean;
};

export function toStaffRows(staff: readonly StaffSource[]): StaffRow[] {
  return staff.map((row) => ({
    key: row.memberId ?? "none",
    name: row.memberId === null ? "Sin asignar" : (row.name ?? "Persona sin nombre"),
    billCount: row.billCount,
    salesTotal: row.salesTotal,
    tipTotal: row.tipTotal,
    cost: row.margin.cost,
    margin: row.margin.margin,
    marginPercent: marginPercent(row.margin.margin, row.margin.costedRevenue),
    marginIncomplete: row.margin.marginIncomplete,
  }));
}

export type TotalsRow = {
  revenue: number;
  cost: number;
  margin: number | null;
  marginPercent: number | null;
  marginIncomplete: boolean;
};

export function toTotalsRow(margin: MarginSource): TotalsRow {
  return {
    revenue: margin.revenue,
    cost: margin.cost,
    margin: margin.margin,
    marginPercent: marginPercent(margin.margin, margin.costedRevenue),
    marginIncomplete: margin.marginIncomplete,
  };
}
