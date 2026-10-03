import { Button } from "@base-template/ui/components/button";
import { OrderStrip } from "@base-template/ui/components/order-strip";
import { formatCop } from "@base-template/ui/lib/format-cop";

import type { OrderView, OrderViewLine } from "../lib/order-view";

const PENDING_LABEL = {
  none: "",
  queued: " · Pendiente de enviar",
  void_queued: " · Anulación pendiente de enviar",
  void_needs_override: " · Falta la autorización para anular",
} as const;

/** One open Table: its order, the lines that can still change and the Waiter's actions. */
export default function TableSessionView({
  tableName,
  billRequested,
  order,
  busy,
  online,
  errorMessage,
  onBack,
  onAddItem,
  onSend,
  onRequestBill,
  onMove,
  onRemoveLine,
  onVoidLine,
  onAuthorizeVoid,
  onDiscount,
  onShowQr,
  qrOffer,
}: {
  tableName: string;
  billRequested: boolean;
  order: OrderView;
  busy: boolean;
  online: boolean;
  errorMessage: string | null;
  onBack: () => void;
  onAddItem: () => void;
  onSend: () => void;
  onRequestBill: () => void;
  onMove: () => void;
  onRemoveLine: (line: OrderViewLine) => void;
  onVoidLine: (line: OrderViewLine) => void;
  onAuthorizeVoid: (line: OrderViewLine) => void;
  onDiscount: () => void;
  onShowQr: () => void;
  qrOffer: { enabled: true } | { enabled: false; reason: string };
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
      {online ? null : (
        <p className="text-sm text-muted-foreground">
          Sin conexión: enviar a cocina, pedir la cuenta y los descuentos necesitan internet.
        </p>
      )}
      <OrderStrip lines={order.lines} />
      {changeable.length > 0 ? (
        <section aria-label="Cambios por línea" className="space-y-2">
          <h3 className="text-sm font-medium">Quitar o anular</h3>
          <ul className="space-y-1">
            {changeable.map((line) => (
              <li key={line.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {line.quantity} × {line.name}
                  {PENDING_LABEL[line.pending ?? "none"]}
                </span>
                {line.pending === "void_queued" ? null : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy || (line.pending === "void_needs_override" && !online)}
                    onClick={() =>
                      line.pending === "void_needs_override"
                        ? onAuthorizeVoid(line)
                        : line.state === "unsent"
                          ? onRemoveLine(line)
                          : onVoidLine(line)
                    }
                  >
                    {line.pending === "void_needs_override"
                      ? "Autorizar anulación de"
                      : line.state === "unsent"
                        ? "Quitar"
                        : "Anular"}{" "}
                    {line.name}
                  </Button>
                )}
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
        <Button type="button" disabled={busy || !online || !order.hasUnsent} onClick={onSend}>
          Enviar a cocina
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onMove}>
          Mover de mesa
        </Button>
        <Button type="button" variant="outline" disabled={busy || !online} onClick={onDiscount}>
          Pedir descuento
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || !online || billRequested}
          onClick={onRequestBill}
        >
          Pedir la cuenta
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || !qrOffer.enabled}
          onClick={onShowQr}
        >
          Mostrar QR de la mesa
        </Button>
      </div>
      {qrOffer.enabled ? null : <p className="text-sm text-muted-foreground">{qrOffer.reason}</p>}
    </div>
  );
}
