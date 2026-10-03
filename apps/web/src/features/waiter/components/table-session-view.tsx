import { Button } from "@base-template/ui/components/button";
import { OrderStrip } from "@base-template/ui/components/order-strip";
import { formatCop } from "@base-template/ui/lib/format-cop";

import type { OrderView, OrderViewLine } from "../lib/order-view";

/** One open Table: its order, the lines that can still change and the Waiter's actions. */
export default function TableSessionView({
  tableName,
  billRequested,
  order,
  busy,
  errorMessage,
  onBack,
  onAddItem,
  onSend,
  onRequestBill,
  onMove,
  onRemoveLine,
  onVoidLine,
  onDiscount,
}: {
  tableName: string;
  billRequested: boolean;
  order: OrderView;
  busy: boolean;
  errorMessage: string | null;
  onBack: () => void;
  onAddItem: () => void;
  onSend: () => void;
  onRequestBill: () => void;
  onMove: () => void;
  onRemoveLine: (line: OrderViewLine) => void;
  onVoidLine: (line: OrderViewLine) => void;
  onDiscount: () => void;
}) {
  const changeable = order.lines.filter((line) => line.state !== "voided");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          Volver a las mesas
        </Button>
        <h2 className="text-lg font-semibold">
          Mesa {tableName}
          {billRequested ? " · Cuenta solicitada" : ""}
        </h2>
      </div>
      {errorMessage ? (
        <p role="alert" className="rounded-md border border-destructive/50 p-3 text-sm">
          {errorMessage}
        </p>
      ) : null}
      <OrderStrip lines={order.lines} />
      {changeable.length > 0 ? (
        <section aria-label="Cambios por línea" className="space-y-2">
          <h3 className="text-sm font-medium">Quitar o anular</h3>
          <ul className="space-y-1">
            {changeable.map((line) => (
              <li key={line.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {line.quantity} × {line.name}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => (line.state === "unsent" ? onRemoveLine(line) : onVoidLine(line))}
                >
                  {line.state === "unsent" ? "Quitar" : "Anular"} {line.name}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-right font-medium">Total {formatCop(order.total)}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={onAddItem}>
          Agregar producto
        </Button>
        <Button type="button" disabled={busy || !order.hasUnsent} onClick={onSend}>
          Enviar a cocina
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onMove}>
          Mover de mesa
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onDiscount}>
          Pedir descuento
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || billRequested}
          onClick={onRequestBill}
        >
          Pedir la cuenta
        </Button>
      </div>
    </div>
  );
}
