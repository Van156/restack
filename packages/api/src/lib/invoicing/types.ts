import type { BuyerDocumentType } from "@base-template/db/schema/restaurant-billing";
import type { menuTaxClass } from "@base-template/db/schema/restaurant-setup";

type MenuTaxClass = (typeof menuTaxClass.enumValues)[number];

/** The DIAN documents a sale can produce: electronic POS equivalent (default) or factura electrónica. */
export const DIAN_DOCUMENT_KINDS = ["pos_equivalent", "factura"] as const;
export type DianDocumentKind = (typeof DIAN_DOCUMENT_KINDS)[number];

/** Habilitación of a company with the DIAN, as shown in the wizard. */
export const HABILITACION_STATUSES = ["not_started", "in_progress", "enabled"] as const;
export type HabilitacionStatus = (typeof HABILITACION_STATUSES)[number];

/** The provider company and numbering a Location issues under. */
export type InvoicingConnection = {
  companyReference: string;
  numberingPrefix: string | null;
};

/** Consumidor final carries no identification and gives the buyer no deduction. */
export type InvoiceBuyer =
  | { kind: "consumidor_final" }
  | {
      kind: "identified";
      documentType: BuyerDocumentType;
      documentNumber: string;
      name: string;
      email: string | null;
    };

/** One Bill line as sent to the provider: tax already derived, amounts in integer COP. */
export type InvoiceLine = {
  name: string;
  quantity: number;
  base: number;
  tax: number;
  total: number;
  taxClass: MenuTaxClass;
};

/** The Bill snapshot an issue request carries; stored as the document payload and never rewritten. */
export type IssueDocumentInput = {
  /** The same key always yields the same document at the provider. */
  idempotencyKey: string;
  kind: DianDocumentKind;
  connection: InvoicingConnection;
  /** Original sale time (offline sales keep the device time). */
  saleTime: Date;
  contingency: boolean;
  buyer: InvoiceBuyer;
  lines: InvoiceLine[];
  /** Voluntary tip as its own line, outside the tax base. */
  tip: number;
  total: number;
};

export type IssuedDocument = {
  status: "accepted";
  providerReference: string;
  number: string;
  cude: string;
  qrData: string;
};

export type RejectedDocument = { status: "rejected"; reason: string };

export type IssueDocumentResult = IssuedDocument | RejectedDocument;

export type DocumentLookup = { idempotencyKey: string } | { providerReference: string };

/**
 * Hexagonal port to a certified DIAN invoicing provider. A transient failure throws
 * {@link InvoicingTransientError}; the outbox retries it.
 * See docs/architecture/restaurant.md#invoicing.
 */
export interface InvoicingProvider {
  issueDocument(input: IssueDocumentInput): Promise<IssueDocumentResult>;
  /** Looks an issued document up for reconciliation; `null` when the provider has none. */
  findDocument(
    lookup: DocumentLookup,
    connection?: InvoicingConnection,
  ): Promise<IssuedDocument | null>;
  habilitacionStatus(connection: InvoicingConnection): Promise<HabilitacionStatus>;
}

/** A failure worth retrying: network, timeout, rate limit or a provider outage. */
export class InvoicingTransientError extends Error {
  readonly retryable = true;

  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "InvoicingTransientError";
  }
}

/** Issuing is disabled because no real provider is configured. */
export class InvoicingNotConfiguredError extends Error {
  constructor(message = "No invoicing provider is configured.") {
    super(message);
    this.name = "InvoicingNotConfiguredError";
  }
}
