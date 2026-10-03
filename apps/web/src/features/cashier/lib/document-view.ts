import type { DocumentKind } from "./document-choice";

export type DocumentStatus = "pending" | "issued" | "rejected";

/** What `dian.getDocuments` returns, as far as the checkout reads it. */
export type DocumentSource = {
  id: string;
  kind: DocumentKind;
  status: DocumentStatus;
  number: string | null;
  cude: string | null;
  qrData: string | null;
  rejectionReason: string | null;
  contingency: boolean;
  buyerName: string | null;
  buyerDocumentNumber: string | null;
  saleTime: Date;
  issuedAt: Date | null;
};

export type DocumentView = {
  id: string;
  kind: DocumentKind;
  status: DocumentStatus;
  number: string | null;
  cude: string | null;
  qrData: string | null;
  rejectionReason: string | null;
  contingency: boolean;
  /** Null for consumidor final. */
  buyer: { name: string; documentNumber: string } | null;
  /** ISO original sale time. */
  saleTime: string;
};

export function toDocumentView(source: DocumentSource): DocumentView {
  return {
    id: source.id,
    kind: source.kind,
    status: source.status,
    number: source.number,
    cude: source.cude,
    qrData: source.qrData,
    rejectionReason: source.rejectionReason,
    contingency: source.contingency,
    buyer:
      source.buyerName && source.buyerDocumentNumber
        ? { name: source.buyerName, documentNumber: source.buyerDocumentNumber }
        : null,
    saleTime: source.saleTime.toISOString(),
  };
}

/** The document the Bill stands on: one not rejected, else the last rejected one. */
export function currentDocument(documents: readonly DocumentView[]): DocumentView | undefined {
  return documents.find((document) => document.status !== "rejected") ?? documents.at(-1);
}

export type RetryOptions = { canRetry: boolean; label: string; canCorrectBuyer: boolean };

/** Rejected: retry (a factura may take a corrected buyer). Pending: transmit now. */
export function retryOptions(document: DocumentView): RetryOptions {
  if (document.status === "rejected") {
    return { canRetry: true, label: "Reintentar", canCorrectBuyer: document.kind === "factura" };
  }
  if (document.status === "pending") {
    return { canRetry: true, label: "Transmitir ahora", canCorrectBuyer: false };
  }
  return { canRetry: false, label: "", canCorrectBuyer: false };
}

/** What the Cashier hands a customer of a Location exempt from electronic invoicing. */
export type ExemptReceipt = {
  note: string;
  lines: { name: string; quantity: number; total: number }[];
  total: number;
  tip: number;
};

/** The receipt in an `issueDocument` answer, or null when it answered with a document. */
export function exemptReceiptOf(answer: unknown): ExemptReceipt | null {
  if (!answer || typeof answer !== "object" || !("kind" in answer)) {
    return null;
  }
  if (answer.kind !== "exempt_receipt") {
    return null;
  }
  const { note, lines, total, tip } = answer as ExemptReceipt & { kind: string };
  return { note, lines, total, tip };
}
