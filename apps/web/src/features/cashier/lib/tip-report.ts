type Share = { memberId: string | null; displayName: string; amount: number };

/** What `cashShift.tipDistributionReport` returns, as far as the screen reads it. */
export type TipReportSource = {
  shifts: {
    cashShiftId: string;
    closedAt: Date | null;
    distributed: boolean;
    tipTotal: number;
    shares: Share[];
  }[];
  people: Share[];
};

export type ReportShare = { key: string; displayName: string; amount: number };

export type TipReport = {
  shifts: {
    cashShiftId: string;
    /** ISO close time. */
    closedAt: string | null;
    tipTotal: number;
    shares: ReportShare[];
  }[];
  /** Each person summed across the period. */
  people: ReportShare[];
  total: number;
};

const toShare = (share: Share): ReportShare => ({
  key: share.memberId ?? `name:${share.displayName}`,
  displayName: share.displayName,
  amount: share.amount,
});

export function toTipReport(source: TipReportSource): TipReport {
  return {
    shifts: source.shifts
      .filter((shift) => shift.distributed)
      .map((shift) => ({
        cashShiftId: shift.cashShiftId,
        closedAt: shift.closedAt?.toISOString() ?? null,
        tipTotal: shift.tipTotal,
        shares: shift.shares.map(toShare),
      })),
    people: source.people.map(toShare),
    total: source.people.reduce((sum, person) => sum + person.amount, 0),
  };
}
