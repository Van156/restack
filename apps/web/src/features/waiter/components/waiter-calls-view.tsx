import { Button } from "@base-template/ui/components/button";
import { formatAge } from "@base-template/ui/lib/format-age";

import type { CallRow } from "../lib/waiter-calls";

/** Guests' calls with their wait; "Voy" tells the guest someone is coming, "Atendido" closes it. */
export default function WaiterCallsView({
  rows,
  online,
  busy,
  onAcknowledge,
  onResolve,
}: {
  rows: readonly CallRow[];
  online: boolean;
  busy: boolean;
  onAcknowledge: (callId: string) => void;
  onResolve: (callId: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nadie está llamando.</p>;
  }
  return (
    <ul className="divide-y rounded-lg border">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
          <div className="space-y-0.5">
            <p className="font-medium">
              Mesa {row.tableName} · {row.reasonLabel}
            </p>
            <p className="text-muted-foreground">
              {row.statusLabel} · hace {formatAge(row.ageMs)}
            </p>
          </div>
          <div className="flex gap-2">
            {row.canAcknowledge ? (
              <Button
                type="button"
                size="sm"
                disabled={busy || !online}
                aria-label={`Voy a la mesa ${row.tableName}`}
                onClick={() => onAcknowledge(row.id)}
              >
                Voy
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !online}
              aria-label={`Mesa ${row.tableName} atendida`}
              onClick={() => onResolve(row.id)}
            >
              Atendido
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
