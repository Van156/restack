import { Input } from "@base-template/ui/components/input";
import { formatSaleTime } from "@base-template/ui/lib/sale-time";

import type { Period } from "../lib/tip-period";
import type { TipReport } from "../lib/tip-report";
import TipSharesList from "./tip-shares-list";

/** The tip distribution report of a period of business days: each person's total and each shift. */
export default function TipReportView({
  period,
  periodError,
  report,
  onPeriodChange,
}: {
  period: Period;
  periodError: string | null;
  /** Null while it loads or when the period is invalid. */
  report: TipReport | null;
  onPeriodChange: (period: Period) => void;
}) {
  return (
    <section aria-label="Reporte de propinas" className="space-y-3 rounded-md border p-3">
      <h3 className="font-medium">Reparto de propinas por período</h3>
      <div className="flex flex-wrap gap-3">
        <label className="space-y-1 text-sm font-medium">
          Desde
          <Input
            type="date"
            value={period.from}
            onChange={(event) => onPeriodChange({ ...period, from: event.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          Hasta
          <Input
            type="date"
            value={period.to}
            onChange={(event) => onPeriodChange({ ...period, to: event.target.value })}
          />
        </label>
      </div>
      {periodError ? (
        <p role="alert" className="text-sm text-destructive">
          {periodError}
        </p>
      ) : null}
      {report ? (
        report.shifts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay turnos con propinas repartidas en este período.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Total por persona</h4>
              <TipSharesList
                label="Total por persona"
                shares={report.people}
                total={report.total}
              />
            </div>
            {report.shifts.map((shift) => (
              <div key={shift.cashShiftId} className="space-y-1">
                <h4 className="text-sm font-medium">
                  Turno cerrado el {shift.closedAt ? formatSaleTime(new Date(shift.closedAt)) : "—"}
                </h4>
                <TipSharesList
                  label={`Turno ${shift.cashShiftId}`}
                  shares={shift.shares}
                  total={shift.tipTotal}
                />
              </div>
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}
