import type { BillView } from "../bill";
import type { DianDocumentKind, InvoiceBuyer, InvoiceLine, IssueDocumentInput } from "./types";

/** Shown with consumidor final documents: the buyer cannot claim the purchase as a cost or deduction. */
export const CONSUMIDOR_FINAL_NOTE =
  "Consumidor final: este documento no da derecho a costos ni deducciones al comprador.";

/** Printed on the simple receipt of a Restaurant that is exempt from electronic invoicing. */
export const EXEMPT_RECEIPT_NOTE = "Este documento no es una factura electrónica";

/** The JSON stored with a document: the Bill snapshot without provider key or connection. */
export type DocumentPayload = {
  kind: DianDocumentKind;
  saleTime: string;
  contingency: boolean;
  buyer: InvoiceBuyer;
  lines: InvoiceLine[];
  tip: number;
  total: number;
};

/** The sale time of a Bill: its latest payment, by device time when it was recorded offline. */
export function saleTimeOf(payments: BillView["payments"]): Date {
  const times = payments.map((payment) =>
    (payment.clientRecordedAt ?? payment.recordedAt).getTime(),
  );
  return new Date(Math.max(...times));
}

/** Freezes a settled Bill into the payload an issue request carries. */
export function buildDocumentPayload(
  view: BillView,
  options: { kind: DianDocumentKind; buyer: InvoiceBuyer; contingency: boolean },
): DocumentPayload {
  return {
    kind: options.kind,
    saleTime: saleTimeOf(view.payments).toISOString(),
    contingency: options.contingency,
    buyer: options.buyer,
    lines: view.lines.map((line) => ({
      name: line.itemName,
      quantity: line.quantity,
      base: line.base,
      tax: line.tax,
      total: line.total,
      taxClass: line.taxClass,
    })),
    tip: view.tip,
    total: view.total,
  };
}

/** The provider input of a stored payload. */
export function toIssueInput(
  payload: DocumentPayload,
  idempotencyKey: string,
  connection: IssueDocumentInput["connection"],
): IssueDocumentInput {
  return { ...payload, saleTime: new Date(payload.saleTime), idempotencyKey, connection };
}

/** Notes to show next to a document. */
export function documentNotes(buyer: InvoiceBuyer): string[] {
  return buyer.kind === "consumidor_final" ? [CONSUMIDOR_FINAL_NOTE] : [];
}
