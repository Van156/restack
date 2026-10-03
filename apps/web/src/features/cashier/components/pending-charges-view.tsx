import { Button } from "@base-template/ui/components/button";
import { StatusBadge } from "@base-template/ui/components/status-badge";
import { formatSaleTime } from "@base-template/ui/lib/sale-time";

import EmptyState from "@/shared/components/feedback/empty-state";

import type { ChargeRow, ChecklistItem } from "../lib/pending-charges";

/** The offline checklist and the outbox of charges and documents still to send. */
export default function PendingChargesView({
  rows,
  checklist,
  online,
  onRetry,
}: {
  rows: readonly ChargeRow[];
  checklist: readonly ChecklistItem[];
  online: boolean;
  onRetry: (key: string) => void;
}) {
  return (
    <div className="space-y-4">
      <section aria-label="Lista de verificación" className="space-y-2 rounded-md border p-3">
        <h3 className="font-medium">Lista de verificación sin conexión</h3>
        <ul className="space-y-1 text-sm">
          {checklist.map((item) => (
            <li key={item.id} className="flex justify-between gap-2">
              <span>
                <span aria-hidden="true">{item.done ? "✓ " : "• "}</span>
                {item.label}
              </span>
              <span className="tabular-nums">{item.count}</span>
            </li>
          ))}
        </ul>
      </section>
      {rows.length === 0 ? (
        <EmptyState
          title="No hay cobros pendientes"
          description="Los cobros hechos sin conexión aparecen aquí hasta que se envían."
        />
      ) : (
        <ul aria-label="Cobros pendientes" className="divide-y rounded-md border">
          {rows.map((row) => (
            <li key={row.key} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="space-y-0.5 text-sm">
                <p className="font-medium">{row.title}</p>
                <p className="text-muted-foreground">
                  Venta del {formatSaleTime(new Date(row.saleTime))}
                </p>
                {row.detail ? <p>{row.detail}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge kind="sync" status={row.status} />
                {row.canRetry ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!online}
                    onClick={() => onRetry(row.key)}
                  >
                    Reintentar
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
