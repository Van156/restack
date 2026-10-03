import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";

import EmptyState from "@/shared/components/feedback/empty-state";

import type { CheckoutRow } from "../lib/checkout-rows";

/** The Bills to charge: open Tables, those that asked for the bill first. */
export default function CheckoutRowsView({
  rows,
  onSelect,
}: {
  rows: readonly CheckoutRow[];
  onSelect: (row: CheckoutRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No hay cuentas por cobrar"
        description="Cuando una mesa tenga pedidos abiertos aparecerá aquí."
      />
    );
  }
  return (
    <ul aria-label="Cuentas por cobrar" className="divide-y rounded-md border">
      {rows.map((row) => (
        <li key={row.sessionId} className="flex items-center justify-between gap-3 p-3">
          <div className="space-y-0.5">
            <p className="font-medium">Mesa {row.tableName}</p>
            {row.areaName ? <p className="text-sm text-muted-foreground">{row.areaName}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            {row.billRequested ? (
              <Badge>Cuenta solicitada</Badge>
            ) : (
              <Badge variant="outline">Abierta</Badge>
            )}
            <Button type="button" onClick={() => onSelect(row)}>
              Cobrar mesa {row.tableName}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
