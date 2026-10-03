import type { Tender } from "@base-template/ui/lib/bill-ledger";
import { formatCop } from "@base-template/ui/lib/format-cop";

export type PaymentDraft = { tender: Tender; amount: string; tendered: string; reference: string };

/** A payment as the server and the queue take it. */
export type PaymentValues = {
  tender: Tender;
  amount: number;
  /** Cash only, when the customer handed over more than the amount. */
  tendered?: number;
  reference?: string;
};

export type PaymentErrors = Partial<Record<"amount" | "tendered" | "reference", string>>;

export type PaymentValidation =
  | { ok: true; payment: PaymentValues; change: number }
  | { ok: false; errors: PaymentErrors };

const REFERENCE_MESSAGE: Record<Exclude<Tender, "cash">, string> = {
  card: "Escribe el número del voucher del datáfono.",
  qr_transfer: "Escribe la referencia que ves en tu propio celular.",
};

/** Whole pesos from text such as `12500` or `$ 12.500`; null when it is not a whole amount. */
export function parsePesos(text: string): number | null {
  const cleaned = text.replace(/^\s*\$?\s*/, "").trim();
  if (!/^\d{1,3}(\.\d{3})+$|^\d+$/.test(cleaned)) {
    return null;
  }
  return Number(cleaned.replaceAll(".", ""));
}

/** The draft a new payment starts from: cash for the whole balance. */
export function initialPaymentDraft(balanceDue: number): PaymentDraft {
  return {
    tender: "cash",
    amount: balanceDue > 0 ? String(balanceDue) : "",
    tendered: "",
    reference: "",
  };
}

/** Change due while the cashier types; zero when the figures do not make sense yet. */
export function previewChange(draft: PaymentDraft): number {
  if (draft.tender !== "cash") {
    return 0;
  }
  const amount = parsePesos(draft.amount);
  const tendered = parsePesos(draft.tendered);
  return amount !== null && tendered !== null && tendered > amount ? tendered - amount : 0;
}

/** Checks a payment against the tender rules and what is still due. */
export function validatePayment(draft: PaymentDraft, balanceDue: number): PaymentValidation {
  const errors: PaymentErrors = {};
  const amount = parsePesos(draft.amount);
  if (amount === null || amount < 1) {
    errors.amount = "Escribe un valor entero mayor que cero.";
  } else if (amount > balanceDue) {
    errors.amount = `El valor no puede superar el saldo pendiente (${formatCop(balanceDue)}).`;
  }

  let tendered: number | undefined;
  let reference: string | undefined;
  if (draft.tender === "cash") {
    if (draft.tendered.trim() !== "") {
      const handed = parsePesos(draft.tendered);
      if (handed === null) {
        errors.tendered = "Escribe el efectivo recibido en pesos enteros.";
      } else if (amount !== null && handed < amount) {
        errors.tendered = "El efectivo recibido no puede ser menor que el valor a cobrar.";
      } else {
        tendered = handed;
      }
    }
  } else {
    reference = draft.reference.trim();
    if (reference === "") {
      errors.reference = REFERENCE_MESSAGE[draft.tender];
    }
  }

  if (Object.keys(errors).length > 0 || amount === null) {
    return { ok: false, errors };
  }
  const payment: PaymentValues = {
    tender: draft.tender,
    amount,
    ...(tendered === undefined ? {} : { tendered }),
    ...(reference === undefined ? {} : { reference }),
  };
  return { ok: true, payment, change: tendered === undefined ? 0 : tendered - amount };
}
