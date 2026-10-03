import { Button } from "@base-template/ui/components/button";
import type { ContingencyTicketProps } from "@base-template/ui/components/contingency-ticket";

import ContingencyTicketView from "./contingency-ticket-view";

/**
 * What the Cashier does after charging offline: ask for the contingency document, then hand over
 * the contingency ticket. The ticket is kept (and reprintable) while the sale waits to sync.
 */
export default function OfflineSaleSection({
  dianEnabled,
  documentQueued,
  ticket,
  busy,
  blockedReason,
  onRequestDocument,
  onPrint,
}: {
  dianEnabled: boolean;
  documentQueued: boolean;
  /** Null until a payment exists to build it from. */
  ticket: ContingencyTicketProps | null;
  busy: boolean;
  /** Why contingency sales are blocked (48 h offline), or null. */
  blockedReason: string | null;
  onRequestDocument: () => void;
  onPrint: () => void;
}) {
  return (
    <section aria-label="Venta sin conexión" className="space-y-3 rounded-md border p-3">
      <h3 className="font-medium">Cobro registrado sin conexión</h3>
      <p className="text-sm text-muted-foreground">
        El cobro está guardado en este dispositivo. La cuenta se cierra y se envía al volver la
        conexión.
      </p>
      {dianEnabled ? (
        documentQueued && ticket ? (
          <>
            <p className="text-sm text-muted-foreground">
              El documento electrónico se transmite a la DIAN al recuperar la conexión, dentro de
              las 48 horas siguientes. Entrega este tiquete al cliente.
            </p>
            <ContingencyTicketView ticket={ticket} onPrint={onPrint} />
          </>
        ) : (
          <>
            {blockedReason ? <p className="text-sm text-destructive">{blockedReason}</p> : null}
            <Button
              type="button"
              disabled={busy || blockedReason !== null}
              onClick={onRequestDocument}
            >
              Generar tiquete de contingencia
            </Button>
          </>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          Este local no factura electrónicamente: el recibo se genera al volver la conexión.
        </p>
      )}
    </section>
  );
}
