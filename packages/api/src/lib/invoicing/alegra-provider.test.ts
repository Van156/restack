import { describe, expect, test } from "bun:test";

import { AlegraInvoicingProvider } from "./alegra-provider";
import { InvoicingTransientError } from "./types";
import type { IssueDocumentInput } from "./types";

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: (Response | Error)[]) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) {
      throw new Error("unexpected request");
    }
    if (next instanceof Error) {
      throw next;
    }
    return next;
  }) as typeof fetch;
  return { calls, impl };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const input = (overrides: Partial<IssueDocumentInput> = {}): IssueDocumentInput => ({
  idempotencyKey: "doc-1",
  kind: "pos_equivalent",
  connection: { companyReference: "company-1", numberingPrefix: "POS" },
  saleTime: new Date("2026-10-02T20:00:00.000Z"),
  contingency: false,
  buyer: { kind: "consumidor_final" },
  lines: [
    {
      name: "Burger",
      quantity: 2,
      base: 37_037,
      tax: 2_963,
      total: 40_000,
      taxClass: "impoconsumo",
    },
  ],
  tip: 4_000,
  total: 40_000,
  ...overrides,
});

const provider = (responses: (Response | Error)[]) => {
  const { calls, impl } = fakeFetch(responses);
  return {
    calls,
    provider: new AlegraInvoicingProvider({
      email: "ops@example.com",
      token: "secret-token",
      baseUrl: "https://alegra.test/api/v1",
      fetch: impl,
    }),
  };
};

const acceptedBody = {
  id: 77,
  numberTemplate: { prefix: "POS", number: "15", fullNumber: "POS15" },
  stamp: { cufe: "cufe-abc", barCodeContent: "qr-content" },
};

describe("AlegraInvoicingProvider", () => {
  test("issues a document with basic auth and maps the stamped response", async () => {
    const { calls, provider: alegra } = provider([json(acceptedBody, 201)]);
    const result = await alegra.issueDocument(input());
    expect(result).toEqual({
      status: "accepted",
      providerReference: "77",
      number: "POS15",
      cude: "cufe-abc",
      qrData: "qr-content",
    });
    expect(calls[0]!.url).toBe("https://alegra.test/api/v1/invoices");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Basic ${btoa("ops@example.com:secret-token")}`);
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.observations).toContain("doc-1");
    expect(body.date).toBe("2026-10-02");
  });

  test("sale date uses the Bogota calendar day", async () => {
    const { calls, provider: alegra } = provider([json(acceptedBody)]);
    await alegra.issueDocument(input({ saleTime: new Date("2026-10-03T03:00:00.000Z") }));
    expect(JSON.parse(String(calls[0]!.init.body)).date).toBe("2026-10-02");
  });

  test("consumidor final uses the generic DIAN identification", async () => {
    const { calls, provider: alegra } = provider([json(acceptedBody)]);
    await alegra.issueDocument(input());
    expect(JSON.parse(String(calls[0]!.init.body)).client.identification).toBe("222222222222");
  });

  test("a client error is a rejection carrying the provider message", async () => {
    const { provider: alegra } = provider([json({ message: "NIT inválido" }, 400)]);
    expect(await alegra.issueDocument(input())).toEqual({
      status: "rejected",
      reason: "NIT inválido",
    });
  });

  test("server errors, rate limits and network failures are transient", async () => {
    for (const response of [json({}, 500), json({}, 503), json({}, 429), new Error("ECONNRESET")]) {
      const { provider: alegra } = provider([response]);
      await expect(alegra.issueDocument(input())).rejects.toBeInstanceOf(InvoicingTransientError);
    }
  });

  test("finds a document by idempotency key through the observations text", async () => {
    const { calls, provider: alegra } = provider([json([acceptedBody])]);
    const found = await alegra.findDocument({ idempotencyKey: "doc-1" });
    expect(found).toMatchObject({ status: "accepted", providerReference: "77" });
    expect(calls[0]!.url).toContain("/invoices?");
    expect(calls[0]!.url).toContain("doc-1");
  });

  test("a lookup with no match returns null and a missing reference is null", async () => {
    const { provider: alegra } = provider([json([]), json({ message: "not found" }, 404)]);
    expect(await alegra.findDocument({ idempotencyKey: "nope" })).toBeNull();
    expect(await alegra.findDocument({ providerReference: "9" })).toBeNull();
  });

  test("habilitación is read from the company electronic invoicing settings", async () => {
    const { provider: alegra } = provider([
      json({ electronicInvoicing: { status: "enabled" } }),
      json({ electronicInvoicing: { status: "in_process" } }),
      json({}),
    ]);
    const connection = { companyReference: "c", numberingPrefix: null };
    expect(await alegra.habilitacionStatus(connection)).toBe("enabled");
    expect(await alegra.habilitacionStatus(connection)).toBe("in_progress");
    expect(await alegra.habilitacionStatus(connection)).toBe("not_started");
  });
});
