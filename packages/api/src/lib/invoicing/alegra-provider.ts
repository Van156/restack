import { businessDayOf } from "@base-template/db/lib/business-day";

import type {
  DocumentLookup,
  HabilitacionStatus,
  InvoicingConnection,
  InvoicingProvider,
  IssueDocumentInput,
  IssueDocumentResult,
  InvoiceLine,
  IssuedDocument,
} from "./types";
import { InvoicingTransientError } from "./types";

const DEFAULT_BASE_URL = "https://api.alegra.com/api/v1";
/** DIAN generic identification for consumidor final. */
const CONSUMIDOR_FINAL_ID = "222222222222";
const OBSERVATION_PREFIX = "restack:";
const DOCUMENT_TYPES = { pos_equivalent: "POS", factura: "INVOICE" } as const;

export type AlegraProviderOptions = {
  email: string;
  token: string;
  baseUrl?: string;
  fetch?: typeof fetch;
};

type AlegraInvoice = {
  id?: number | string;
  observations?: string;
  numberTemplate?: { prefix?: string; number?: string | number; fullNumber?: string };
  stamp?: { cufe?: string; barCodeContent?: string };
};

/**
 * Alegra adapter: basic auth, `POST /invoices`, the `stamp` object; the rest is assumed.
 * See docs/architecture/restaurant.md#alegra-assumptions.
 */
export class AlegraInvoicingProvider implements InvoicingProvider {
  private readonly baseUrl: string;
  private readonly authorization: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AlegraProviderOptions) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.authorization = `Basic ${btoa(`${options.email}:${options.token}`)}`;
    this.fetchImpl = options.fetch ?? fetch;
  }

  async issueDocument(input: IssueDocumentInput): Promise<IssueDocumentResult> {
    // Alegra has no idempotency key: a POST that timed out may still have created the invoice.
    const existing = await this.findDocument({ idempotencyKey: input.idempotencyKey });
    if (existing) {
      return existing;
    }
    const response = await this.request("POST", "/invoices", this.invoiceBody(input));
    if (response.ok) {
      const issued = toIssuedDocument((await response.json()) as AlegraInvoice);
      if (!issued) {
        throw new InvoicingTransientError("Alegra answered without a stamped document.");
      }
      return issued;
    }
    if (isTransientStatus(response.status)) {
      throw new InvoicingTransientError(`Alegra answered ${response.status}.`);
    }
    return { status: "rejected", reason: await errorMessage(response) };
  }

  async findDocument(lookup: DocumentLookup): Promise<IssuedDocument | null> {
    if ("providerReference" in lookup) {
      const response = await this.request(
        "GET",
        `/invoices/${encodeURIComponent(lookup.providerReference)}`,
      );
      if (response.status === 404) {
        return null;
      }
      return this.readOne(response);
    }
    const query = encodeURIComponent(`${OBSERVATION_PREFIX}${lookup.idempotencyKey}`);
    const response = await this.request("GET", `/invoices?query=${query}`);
    if (!response.ok) {
      return this.readOne(response);
    }
    // The query is a text search, so `doc-1` also hits `doc-10`: keep the exact key only.
    const list = (await response.json()) as AlegraInvoice[];
    const observed = `${OBSERVATION_PREFIX}${lookup.idempotencyKey}`;
    const match = list.find((invoice) => invoice.observations === observed);
    return match ? (toIssuedDocument(match) ?? null) : null;
  }

  async habilitacionStatus(_connection: InvoicingConnection): Promise<HabilitacionStatus> {
    const response = await this.request("GET", "/company");
    if (!response.ok) {
      throw new InvoicingTransientError(`Alegra answered ${response.status}.`);
    }
    const company = (await response.json()) as { electronicInvoicing?: { status?: string } };
    const status = company.electronicInvoicing?.status;
    if (status === "enabled") {
      return "enabled";
    }
    return status ? "in_progress" : "not_started";
  }

  private async readOne(response: Response): Promise<IssuedDocument | null> {
    if (!response.ok) {
      if (isTransientStatus(response.status)) {
        throw new InvoicingTransientError(`Alegra answered ${response.status}.`);
      }
      return null;
    }
    return toIssuedDocument((await response.json()) as AlegraInvoice) ?? null;
  }

  private async request(method: string, path: string, body?: unknown): Promise<Response> {
    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          authorization: this.authorization,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new InvoicingTransientError("Could not reach Alegra.", error);
    }
  }

  /** Assumed request shape; see docs/architecture/restaurant.md#alegra-assumptions. */
  private invoiceBody(input: IssueDocumentInput) {
    const date = businessDayOf(input.saleTime);
    const buyer = input.buyer;
    return {
      date,
      dueDate: date,
      status: "open",
      documentType: DOCUMENT_TYPES[input.kind],
      observations: `${OBSERVATION_PREFIX}${input.idempotencyKey}`,
      client:
        buyer.kind === "consumidor_final"
          ? { name: "Consumidor final", identification: CONSUMIDOR_FINAL_ID }
          : {
              name: buyer.name,
              identification: buyer.documentNumber,
              identificationObject: {
                type: buyer.documentType.toUpperCase(),
                number: buyer.documentNumber,
              },
              email: buyer.email ?? undefined,
            },
      items: input.lines.map(toItem),
      tip: input.tip,
      numberTemplate: input.connection.numberingPrefix
        ? { prefix: input.connection.numberingPrefix }
        : undefined,
      company: input.connection.companyReference,
      stamp: { generateStamp: true },
    };
  }
}

/**
 * Integer COP only: when `base / quantity` is not whole the line is sent as one unit at the line
 * base, so the provider reproduces the base exactly. The tax is our Bill's, not recomputed.
 */
function toItem(line: InvoiceLine) {
  const wholeUnitPrice = line.base % line.quantity === 0;
  return {
    name: wholeUnitPrice ? line.name : `${line.name} x${line.quantity}`,
    quantity: wholeUnitPrice ? line.quantity : 1,
    price: wholeUnitPrice ? line.base / line.quantity : line.base,
    tax: [{ name: line.taxClass, amount: line.tax }],
  };
}

function toIssuedDocument(invoice: AlegraInvoice): IssuedDocument | null {
  const cude = invoice.stamp?.cufe;
  if (invoice.id === undefined || !cude) {
    return null;
  }
  const template = invoice.numberTemplate;
  const number = template?.fullNumber ?? `${template?.prefix ?? ""}${template?.number ?? ""}`;
  return {
    status: "accepted",
    providerReference: String(invoice.id),
    number,
    cude,
    qrData: invoice.stamp?.barCodeContent ?? "",
  };
}

function isTransientStatus(status: number): boolean {
  return status >= 500 || status === 429 || status === 408;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? `Alegra rejected the document (${response.status}).`;
  } catch {
    return `Alegra rejected the document (${response.status}).`;
  }
}
