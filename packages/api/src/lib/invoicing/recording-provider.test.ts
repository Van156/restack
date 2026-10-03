import { describe, expect, test } from "bun:test";

import { RecordingInvoicingProvider } from "./recording-provider";
import { InvoicingTransientError } from "./types";
import type { IssueDocumentInput } from "./types";

const input = (overrides: Partial<IssueDocumentInput> = {}): IssueDocumentInput => ({
  idempotencyKey: "doc-1",
  kind: "pos_equivalent",
  connection: { companyReference: "company-1", numberingPrefix: "POS" },
  saleTime: new Date("2026-10-02T15:00:00.000Z"),
  contingency: false,
  buyer: { kind: "consumidor_final" },
  lines: [
    {
      name: "Burger",
      quantity: 1,
      base: 18_519,
      tax: 1_481,
      total: 20_000,
      taxClass: "impoconsumo",
    },
  ],
  tip: 0,
  total: 20_000,
  ...overrides,
});

describe("RecordingInvoicingProvider", () => {
  test("accepts a document with a deterministic number, reference and CUDE", async () => {
    const provider = new RecordingInvoicingProvider();
    const result = await provider.issueDocument(input());
    expect(result).toEqual({
      status: "accepted",
      providerReference: "fake-doc-1",
      number: "POS1",
      cude: "fake-cude-doc-1",
      qrData: "fake-qr:doc-1",
    });
  });

  test("the same idempotency key returns the same document and issues nothing new", async () => {
    const provider = new RecordingInvoicingProvider();
    const first = await provider.issueDocument(input());
    const second = await provider.issueDocument(input());
    expect(second).toEqual(first);
    expect(provider.issued).toHaveLength(1);
    expect(provider.calls).toHaveLength(2);
  });

  test("numbers advance per distinct document", async () => {
    const provider = new RecordingInvoicingProvider();
    await provider.issueDocument(input());
    const second = await provider.issueDocument(input({ idempotencyKey: "doc-2" }));
    expect(second).toMatchObject({ status: "accepted", number: "POS2" });
  });

  test("scripted rejection and transient failure are consumed in order", async () => {
    const provider = new RecordingInvoicingProvider();
    provider.script([{ reject: "Invalid buyer identification" }, { transient: "timeout" }]);
    expect(await provider.issueDocument(input())).toEqual({
      status: "rejected",
      reason: "Invalid buyer identification",
    });
    await expect(provider.issueDocument(input({ idempotencyKey: "doc-2" }))).rejects.toBeInstanceOf(
      InvoicingTransientError,
    );
    expect(await provider.issueDocument(input({ idempotencyKey: "doc-3" }))).toMatchObject({
      status: "accepted",
    });
  });

  test("can be told to be unreachable until restored", async () => {
    const provider = new RecordingInvoicingProvider();
    provider.setReachable(false);
    await expect(provider.issueDocument(input())).rejects.toBeInstanceOf(InvoicingTransientError);
    provider.setReachable(true);
    expect(await provider.issueDocument(input())).toMatchObject({ status: "accepted" });
  });

  test("finds an issued document by idempotency key or provider reference", async () => {
    const provider = new RecordingInvoicingProvider();
    await provider.issueDocument(input());
    const byKey = await provider.findDocument({ idempotencyKey: "doc-1" });
    const byReference = await provider.findDocument({ providerReference: "fake-doc-1" });
    expect(byKey).toMatchObject({ status: "accepted", number: "POS1" });
    expect(byReference).toEqual(byKey);
    expect(await provider.findDocument({ idempotencyKey: "missing" })).toBeNull();
  });

  test("reports the scripted habilitación status", async () => {
    const provider = new RecordingInvoicingProvider();
    expect(
      await provider.habilitacionStatus({ companyReference: "c", numberingPrefix: null }),
    ).toBe("enabled");
    provider.setHabilitacion("in_progress");
    expect(
      await provider.habilitacionStatus({ companyReference: "c", numberingPrefix: null }),
    ).toBe("in_progress");
  });
});
