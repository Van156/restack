import { describe, expect, test } from "bun:test";

import {
  CONSUMIDOR_FINAL_COPY,
  buyerLabel,
  consumidorFinalNote,
  documentOptions,
  documentRequest,
  validateBuyer,
} from "./document-choice";

const buyer = {
  id: "b1",
  documentType: "nit",
  documentNumber: "900123456",
  name: "Acme SAS",
} as const;

describe("documentOptions", () => {
  test("with DIAN on, the POS document is the default and a factura is offered online", () => {
    expect(documentOptions({ dianEnabled: true, online: true })).toEqual({
      mode: "dian",
      kinds: ["pos_equivalent", "factura"],
      buyerSearch: true,
    });
  });

  test("offline only the POS document is offered, with no buyer search", () => {
    expect(documentOptions({ dianEnabled: true, online: false })).toEqual({
      mode: "dian",
      kinds: ["pos_equivalent"],
      buyerSearch: false,
    });
  });

  test("a Location exempt from electronic invoicing gets a simple receipt and no choice", () => {
    expect(documentOptions({ dianEnabled: false, online: true })).toEqual({
      mode: "exempt",
      kinds: [],
      buyerSearch: false,
    });
  });
});

describe("documentRequest", () => {
  test("a POS document needs no buyer: it goes out as consumidor final", () => {
    expect(documentRequest("pos_equivalent", null)).toEqual({
      ok: true,
      request: { kind: "pos_equivalent" },
    });
  });

  test("a POS document may carry a buyer who asked for their data", () => {
    expect(documentRequest("pos_equivalent", buyer)).toEqual({
      ok: true,
      request: { kind: "pos_equivalent", buyerId: "b1" },
    });
  });

  test("a factura needs the buyer's identification", () => {
    expect(documentRequest("factura", null)).toEqual({
      ok: false,
      error: "Una factura necesita buscar o registrar al comprador.",
    });
    expect(documentRequest("factura", buyer)).toEqual({
      ok: true,
      request: { kind: "factura", buyerId: "b1" },
    });
  });
});

describe("consumidorFinalNote", () => {
  test("warns that the document gives the buyer no deduction when there is no buyer", () => {
    expect(consumidorFinalNote(null)).toBe(CONSUMIDOR_FINAL_COPY);
    expect(CONSUMIDOR_FINAL_COPY).toContain("no da derecho a costos ni deducciones");
    expect(consumidorFinalNote(buyer)).toBeNull();
  });
});

describe("buyerLabel", () => {
  test("shows the name with the type and number of the document", () => {
    expect(buyerLabel(buyer)).toBe("Acme SAS · NIT 900123456");
    expect(buyerLabel({ ...buyer, documentType: "cc" })).toBe("Acme SAS · CC 900123456");
  });
});

describe("validateBuyer", () => {
  const values = {
    documentType: "cc" as const,
    documentNumber: " 1020304050 ",
    name: " Ana Ruiz ",
    email: "",
    consent: true,
  };

  test("saves only with the buyer's consent", () => {
    expect(validateBuyer({ ...values, consent: false })).toEqual({
      ok: false,
      errors: { consent: "El comprador debe autorizar guardar sus datos (Ley 1581)." },
    });
  });

  test("trims the fields and leaves a blank email out", () => {
    expect(validateBuyer(values)).toEqual({
      ok: true,
      buyer: {
        documentType: "cc",
        documentNumber: "1020304050",
        name: "Ana Ruiz",
        consent: true,
      },
    });
  });

  test("keeps a valid email", () => {
    const result = validateBuyer({ ...values, email: " ana@correo.co " });
    expect(result.ok && result.buyer.email).toBe("ana@correo.co");
  });

  test("reports a missing number or name and a malformed email", () => {
    const result = validateBuyer({ ...values, documentNumber: " ", name: "", email: "ana@" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["documentNumber", "email", "name"]);
    }
  });
});
