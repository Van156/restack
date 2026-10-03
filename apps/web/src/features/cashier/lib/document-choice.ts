export type DocumentKind = "pos_equivalent" | "factura";
export type BuyerDocumentType = "cc" | "ce" | "nit" | "ti" | "pp" | "te";

export const BUYER_DOCUMENT_TYPES: readonly BuyerDocumentType[] = [
  "cc",
  "ce",
  "nit",
  "ti",
  "pp",
  "te",
];

/** A buyer of the directory. */
export type BuyerSummary = {
  id: string;
  documentType: BuyerDocumentType;
  documentNumber: string;
  name: string;
};

/** Same text the document carries (the server returns it with the document). */
export const CONSUMIDOR_FINAL_COPY =
  "Consumidor final: este documento no da derecho a costos ni deducciones al comprador.";

export type DocumentOptions = {
  /** `exempt`: the Location is exempt from electronic invoicing and gets a simple receipt. */
  mode: "dian" | "exempt";
  kinds: DocumentKind[];
  buyerSearch: boolean;
};

/** What the Cashier can choose: the buyer directory and a factura need a connection. */
export function documentOptions(input: { dianEnabled: boolean; online: boolean }): DocumentOptions {
  if (!input.dianEnabled) {
    return { mode: "exempt", kinds: [], buyerSearch: false };
  }
  return input.online
    ? { mode: "dian", kinds: ["pos_equivalent", "factura"], buyerSearch: true }
    : { mode: "dian", kinds: ["pos_equivalent"], buyerSearch: false };
}

export type DocumentRequest = { kind: DocumentKind; buyerId?: string };

export type DocumentRequestResult =
  | { ok: true; request: DocumentRequest }
  | { ok: false; error: string };

/** The issue request for the chosen kind and buyer; a factura cannot go out without one. */
export function documentRequest(
  kind: DocumentKind,
  buyer: BuyerSummary | null,
): DocumentRequestResult {
  if (kind === "factura" && !buyer) {
    return { ok: false, error: "Una factura necesita buscar o registrar al comprador." };
  }
  return { ok: true, request: buyer ? { kind, buyerId: buyer.id } : { kind } };
}

/** The no-deduction note shown while the document would go to consumidor final. */
export function consumidorFinalNote(buyer: BuyerSummary | null): string | null {
  return buyer ? null : CONSUMIDOR_FINAL_COPY;
}

export function buyerLabel(buyer: Pick<BuyerSummary, "name" | "documentType" | "documentNumber">) {
  return `${buyer.name} · ${buyer.documentType.toUpperCase()} ${buyer.documentNumber}`;
}

export type BuyerValues = {
  documentType: BuyerDocumentType;
  documentNumber: string;
  name: string;
  email: string;
  consent: boolean;
};

export type BuyerErrors = Partial<Record<"documentNumber" | "name" | "email" | "consent", string>>;

export type BuyerValidation =
  | {
      ok: true;
      buyer: {
        documentType: BuyerDocumentType;
        documentNumber: string;
        name: string;
        email?: string;
        consent: true;
      };
    }
  | { ok: false; errors: BuyerErrors };

/** A buyer ready to save to the directory. */
export type NewBuyer = Extract<BuyerValidation, { ok: true }>["buyer"];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A buyer is saved to the directory only with their consent (Ley 1581). */
export function validateBuyer(values: BuyerValues): BuyerValidation {
  const errors: BuyerErrors = {};
  const documentNumber = values.documentNumber.trim();
  const name = values.name.trim();
  const email = values.email.trim();
  if (documentNumber === "") {
    errors.documentNumber = "Escribe el número del documento.";
  }
  if (name === "") {
    errors.name = "Escribe el nombre o la razón social.";
  }
  if (email !== "" && !EMAIL.test(email)) {
    errors.email = "El correo no parece válido.";
  }
  if (!values.consent) {
    errors.consent = "El comprador debe autorizar guardar sus datos (Ley 1581).";
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    buyer: {
      documentType: values.documentType,
      documentNumber,
      name,
      ...(email === "" ? {} : { email }),
      consent: true,
    },
  };
}
