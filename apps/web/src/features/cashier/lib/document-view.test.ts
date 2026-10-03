import { describe, expect, test } from "bun:test";

import {
  currentDocument,
  exemptReceiptOf,
  retryOptions,
  toDocumentView,
  type DocumentSource,
} from "./document-view";

const row: DocumentSource = {
  id: "d1",
  kind: "pos_equivalent",
  status: "issued",
  number: "POS-12",
  cude: "abc123",
  qrData: "https://dian.example/qr?x=1",
  rejectionReason: null,
  contingency: false,
  buyerName: null,
  buyerDocumentNumber: null,
  saleTime: new Date("2026-10-03T22:05:09Z"),
  issuedAt: new Date("2026-10-03T22:05:20Z"),
};

describe("toDocumentView", () => {
  test("keeps what the Cashier hands over: number, CUDE and QR", () => {
    expect(toDocumentView(row)).toMatchObject({
      id: "d1",
      status: "issued",
      number: "POS-12",
      cude: "abc123",
      qrData: "https://dian.example/qr?x=1",
      buyer: null,
      saleTime: "2026-10-03T22:05:09.000Z",
    });
  });

  test("names the buyer of a factura", () => {
    expect(
      toDocumentView({ ...row, kind: "factura", buyerName: "Acme SAS", buyerDocumentNumber: "900" })
        .buyer,
    ).toEqual({ name: "Acme SAS", documentNumber: "900" });
  });
});

describe("currentDocument", () => {
  const view = (id: string, status: "pending" | "issued" | "rejected") => ({
    ...toDocumentView(row),
    id,
    status,
  });

  test("is the document that is not rejected, else the last rejected one, else nothing", () => {
    expect(currentDocument([view("a", "rejected"), view("b", "issued")])?.id).toBe("b");
    expect(currentDocument([view("a", "rejected"), view("b", "rejected")])?.id).toBe("b");
    expect(currentDocument([])).toBeUndefined();
  });
});

describe("retryOptions", () => {
  const document = toDocumentView(row);

  test("a rejected document can be retried, a factura with a corrected buyer", () => {
    expect(retryOptions({ ...document, status: "rejected" })).toEqual({
      canRetry: true,
      label: "Reintentar",
      canCorrectBuyer: false,
    });
    expect(retryOptions({ ...document, status: "rejected", kind: "factura" })).toEqual({
      canRetry: true,
      label: "Reintentar",
      canCorrectBuyer: true,
    });
  });

  test("a pending document can be transmitted now; an issued one needs nothing", () => {
    expect(retryOptions({ ...document, status: "pending" })).toEqual({
      canRetry: true,
      label: "Transmitir ahora",
      canCorrectBuyer: false,
    });
    expect(retryOptions(document)).toEqual({ canRetry: false, label: "", canCorrectBuyer: false });
  });
});

describe("exemptReceiptOf", () => {
  const answer = {
    kind: "exempt_receipt",
    replayed: false,
    note: "Este documento no es una factura electrónica",
    lines: [{ name: "Bandeja", quantity: 2, total: 52_000 }],
    total: 52_000,
    tip: 5_200,
  };

  test("takes the receipt of a Location exempt from electronic invoicing", () => {
    expect(exemptReceiptOf(answer)).toEqual({
      note: "Este documento no es una factura electrónica",
      lines: [{ name: "Bandeja", quantity: 2, total: 52_000 }],
      total: 52_000,
      tip: 5_200,
    });
  });

  test("is null for an issued document or any other answer", () => {
    expect(exemptReceiptOf({ kind: "document", document: {} })).toBeNull();
    expect(exemptReceiptOf(undefined)).toBeNull();
    expect(exemptReceiptOf("x")).toBeNull();
  });
});
