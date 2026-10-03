import { Button } from "@base-template/ui/components/button";
import type { ReactNode } from "react";

import {
  consumidorFinalNote,
  type BuyerSummary,
  type DocumentKind,
  type DocumentOptions,
} from "../lib/document-choice";

const KIND_LABEL: Record<DocumentKind, string> = {
  pos_equivalent: "Documento equivalente POS",
  factura: "Factura electrónica",
};

/**
 * Chooses the document of a charged Bill: the POS document by default, or a factura with the
 * buyer's identification (the `buyerPicker` slot). Without a buyer the note says consumidor final.
 */
export default function DocumentChoiceForm({
  options,
  kind,
  buyer,
  buyerPicker,
  busy,
  error,
  onKindChange,
  onIssue,
}: {
  options: DocumentOptions;
  kind: DocumentKind;
  buyer: BuyerSummary | null;
  buyerPicker: ReactNode;
  busy: boolean;
  error: string | null;
  onKindChange: (kind: DocumentKind) => void;
  onIssue: () => void;
}) {
  const exempt = options.mode === "exempt";
  const note = !exempt && kind === "pos_equivalent" ? consumidorFinalNote(buyer) : null;
  return (
    <section aria-label="Documento" className="space-y-3 rounded-md border p-3">
      <h3 className="font-medium">{exempt ? "Recibo" : "Documento de la venta"}</h3>
      {exempt ? (
        <p className="text-sm text-muted-foreground">
          Este local no factura electrónicamente: se entrega un recibo simple.
        </p>
      ) : (
        <>
          <div role="group" aria-label="Tipo de documento" className="flex flex-wrap gap-2">
            {options.kinds.map((option) => (
              <Button
                key={option}
                type="button"
                variant={kind === option ? "default" : "outline"}
                aria-pressed={kind === option}
                onClick={() => onKindChange(option)}
              >
                {KIND_LABEL[option]}
              </Button>
            ))}
          </div>
          {options.buyerSearch ? (
            buyerPicker
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin conexión: solo se puede emitir el documento a consumidor final. Una factura se
              pide cuando vuelva la conexión.
            </p>
          )}
          {note ? <p className="text-sm">{note}</p> : null}
        </>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="button" disabled={busy} onClick={onIssue}>
        {exempt ? "Generar recibo" : "Emitir documento"}
      </Button>
    </section>
  );
}
