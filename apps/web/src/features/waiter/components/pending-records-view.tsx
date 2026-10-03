import { Button } from "@base-template/ui/components/button";
import { StatusBadge } from "@base-template/ui/components/status-badge";

import type { PendingRow } from "../lib/pending-records";

/** Records saved on this device that the server has not accepted yet, with what can be done. */
export default function PendingRecordsView({
  rows,
  online,
  onRetry,
  onAuthorize,
}: {
  rows: readonly PendingRow[];
  online: boolean;
  onRetry: (key: string) => void;
  onAuthorize: (row: PendingRow) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay nada pendiente de enviar.</p>;
  }
  return (
    <ul className="divide-y rounded-lg border">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
          <div className="space-y-1">
            <p className="font-medium">{row.label}</p>
            {row.message ? <p className="text-muted-foreground">{row.message}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge kind="sync" status={row.status} />
            {row.action === "retry" ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onRetry(row.key)}>
                Reintentar
              </Button>
            ) : null}
            {row.action === "authorize" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!online}
                onClick={() => onAuthorize(row)}
              >
                Autorizar
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
