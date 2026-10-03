import { tenderLabel, type Tender } from "@base-template/ui/lib/bill-ledger";

const TENDERS = ["cash", "card", "qr_transfer"] as const satisfies readonly Tender[];
type TenderTotals = Record<(typeof TENDERS)[number], { count: number; amount: number }>;

type Totals = {
  billCount: number;
  salesTotal: number;
  tipTotal: number;
  collectedTotal: number;
  tenders: TenderTotals;
};

/** What `reports.daily` returns, as far as the screen reads it. */
export type DailyReportSource = Totals & {
  date: string;
  byLocation: readonly (Totals & { locationId: string; name: string })[];
  documents: {
    total: number;
    byStatus: { pending: number; issued: number; rejected: number };
    byKind: { pos_equivalent: number; factura: number };
  };
};

const DOCUMENT_STATUSES = [
  { status: "pending", label: "Pendientes" },
  { status: "issued", label: "Emitidos" },
  { status: "rejected", label: "Rechazados" },
] as const;

export type SalesView = {
  billCount: number;
  salesTotal: number;
  tipTotal: number;
  collectedTotal: number;
  tenders: { tender: Tender; label: string; count: number; amount: number }[];
  documents: {
    total: number;
    rows: { status: (typeof DOCUMENT_STATUSES)[number]["status"]; label: string; count: number }[];
  };
  locations: {
    locationId: string;
    name: string;
    billCount: number;
    salesTotal: number;
    tipTotal: number;
  }[];
  isEmpty: boolean;
};

/** The daily report as rows: tenders, tips apart from sales, document counts, a row per Location. */
export function toSalesView(source: DailyReportSource): SalesView {
  return {
    billCount: source.billCount,
    salesTotal: source.salesTotal,
    tipTotal: source.tipTotal,
    collectedTotal: source.collectedTotal,
    tenders: TENDERS.map((tender) => ({
      tender,
      label: tenderLabel(tender),
      ...source.tenders[tender],
    })),
    documents: {
      total: source.documents.total,
      rows: DOCUMENT_STATUSES.map(({ status, label }) => ({
        status,
        label,
        count: source.documents.byStatus[status],
      })),
    },
    locations: source.byLocation.map((row) => ({
      locationId: row.locationId,
      name: row.name,
      billCount: row.billCount,
      salesTotal: row.salesTotal,
      tipTotal: row.tipTotal,
    })),
    isEmpty: source.billCount === 0,
  };
}
