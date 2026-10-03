import { Button } from "@base-template/ui/components/button";
import { QrPanel } from "@base-template/ui/components/qr-panel";
import { StatusBadge } from "@base-template/ui/components/status-badge";
import { formatCop } from "@base-template/ui/lib/format-cop";
import { formatSaleTime } from "@base-template/ui/lib/sale-time";
import type { ReactNode } from "react";

import { CONSUMIDOR_FINAL_COPY } from "../lib/document-choice";
import { retryOptions, type DocumentView, type ExemptReceipt } from "../lib/document-view";

const KIND_LABEL = {
  pos_equivalent: "Documento equivalente POS",
  factura: "Factura electrónica",
} as const;

/** An issued, pending or rejected document with its CUDE and QR, ready to print or show. */
export function DocumentResult({
  document,
  busy,
  online,
  corrector,
  onRetry,
  onPrint,
}: {
  document: DocumentView;
  busy: boolean;
  online: boolean;
  /** Buyer picker to fix a rejected factura before retrying. */
  corrector?: ReactNode;
  onRetry: () => void;
  onPrint: () => void;
}) {
  const retry = retryOptions(document);
  return (
    <section aria-label="Documento emitido" className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{KIND_LABEL[document.kind]}</h3>
        <StatusBadge kind="document" status={document.status} />
      </div>
      <div data-print-area className="space-y-1 text-sm">
        {document.number ? <p>No. {document.number}</p> : null}
        <p>Fecha de la venta: {formatSaleTime(new Date(document.saleTime))}</p>
        <p>
          Cliente:{" "}
          {document.buyer
            ? `${document.buyer.name} · ${document.buyer.documentNumber}`
            : "Consumidor final"}
        </p>
        {document.buyer ? null : <p>{CONSUMIDOR_FINAL_COPY}</p>}
        {document.cude ? <p className="break-all font-mono text-xs">CUDE {document.cude}</p> : null}
        {document.status === "issued" && document.qrData ? (
          <QrPanel url={document.qrData} title="Código QR del documento" />
        ) : null}
      </div>
      {document.status === "rejected" && document.rejectionReason ? (
        <p role="alert" className="text-sm text-destructive">
          La DIAN o el proveedor rechazó el documento: {document.rejectionReason}
        </p>
      ) : null}
      {document.status === "pending" ? (
        <p className="text-sm text-muted-foreground">
          {document.contingency
            ? "Pendiente de transmitir a la DIAN. Se envía solo al recuperar la conexión."
            : "Pendiente: el proveedor aún no confirma el documento."}
        </p>
      ) : null}
      {retry.canCorrectBuyer ? corrector : null}
      <div className="flex flex-wrap gap-2">
        {retry.canRetry ? (
          <Button type="button" disabled={busy || !online} onClick={onRetry}>
            {retry.label}
          </Button>
        ) : null}
        {document.status === "issued" ? (
          <Button type="button" variant="outline" onClick={onPrint}>
            Imprimir
          </Button>
        ) : null}
      </div>
    </section>
  );
}

/** The simple receipt of a Location exempt from electronic invoicing. */
export function ExemptReceiptView({
  receipt,
  onPrint,
}: {
  receipt: ExemptReceipt;
  onPrint: () => void;
}) {
  return (
    <section aria-label="Recibo" className="space-y-3 rounded-md border p-3">
      <div data-print-area className="space-y-1 text-sm">
        <h3 className="font-medium">Recibo</h3>
        <ul>
          {receipt.lines.map((line, index) => (
            <li key={`${index}-${line.name}`} className="flex justify-between gap-2">
              <span>
                {line.quantity} × {line.name}
              </span>
              <span className="tabular-nums">{formatCop(line.total)}</span>
            </li>
          ))}
        </ul>
        <p className="font-semibold">Total {formatCop(receipt.total)}</p>
        <p>Propina voluntaria {formatCop(receipt.tip)}</p>
        <p>{receipt.note}</p>
      </div>
      <Button type="button" variant="outline" onClick={onPrint}>
        Imprimir
      </Button>
    </section>
  );
}
