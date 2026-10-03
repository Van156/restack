import { formatAge } from "@base-template/ui/lib/format-age";

/** The timing block of `reports.kitchen`. */
export type TimingSource = {
  ticketCount: number;
  completedCount: number;
  avgPrepMs: number | null;
  maxPrepMs: number | null;
  avgPickupMs: number | null;
  maxPickupMs: number | null;
  avgSentToReadyMs: number | null;
  maxSentToReadyMs: number | null;
};

export type KitchenReportSource = {
  date: string;
  total: TimingSource;
  byLocation: readonly (TimingSource & { locationId: string; name: string })[];
};

type Timing = { average: string; worst: string };

export type KitchenRow = {
  ticketCount: number;
  completedCount: number;
  sentToReady: Timing;
  preparation: Timing;
  pickup: Timing;
};

const NONE = "—";
const format = (ms: number | null) => (ms === null ? NONE : formatAge(ms));

function toRow(source: TimingSource): KitchenRow {
  return {
    ticketCount: source.ticketCount,
    completedCount: source.completedCount,
    sentToReady: {
      average: format(source.avgSentToReadyMs),
      worst: format(source.maxSentToReadyMs),
    },
    preparation: { average: format(source.avgPrepMs), worst: format(source.maxPrepMs) },
    pickup: { average: format(source.avgPickupMs), worst: format(source.maxPickupMs) },
  };
}

export type KitchenView = {
  total: KitchenRow;
  locations: (KitchenRow & { locationId: string; name: string })[];
  isEmpty: boolean;
};

/** Timings as text: sent to ready, preparation and pickup wait, average and worst. */
export function toKitchenRows(source: KitchenReportSource): KitchenView {
  return {
    total: toRow(source.total),
    locations: source.byLocation.map((row) => ({
      locationId: row.locationId,
      name: row.name,
      ...toRow(row),
    })),
    isEmpty: source.total.ticketCount === 0,
  };
}
