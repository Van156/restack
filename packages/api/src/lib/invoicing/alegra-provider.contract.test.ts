import { describe, expect, test } from "bun:test";

import { AlegraInvoicingProvider } from "./alegra-provider";

const email = process.env.ALEGRA_SANDBOX_EMAIL;
const token = process.env.ALEGRA_SANDBOX_TOKEN;
const company = process.env.ALEGRA_SANDBOX_COMPANY ?? "sandbox";
const configured = Boolean(email && token);

describe.skipIf(!configured)("Alegra sandbox contract", () => {
  const provider = () =>
    new AlegraInvoicingProvider({
      email: email!,
      token: token!,
      baseUrl: process.env.ALEGRA_SANDBOX_BASE_URL,
    });
  const connection = { companyReference: company, numberingPrefix: null };

  test("reports a known habilitación status", async () => {
    expect(["not_started", "in_progress", "enabled"]).toContain(
      await provider().habilitacionStatus(connection),
    );
  });

  test("an issue answers accepted or rejected, and an accepted one is found by key", async () => {
    const idempotencyKey = `contract-${crypto.randomUUID()}`;
    const result = await provider().issueDocument({
      idempotencyKey,
      kind: "pos_equivalent",
      connection,
      saleTime: new Date(),
      contingency: false,
      buyer: { kind: "consumidor_final" },
      lines: [
        {
          name: "Contract test",
          quantity: 1,
          base: 10_000,
          tax: 0,
          total: 10_000,
          taxClass: "impoconsumo",
        },
      ],
      tip: 0,
      total: 10_000,
    });
    expect(["accepted", "rejected"]).toContain(result.status);
    if (result.status === "accepted") {
      expect(await provider().findDocument({ idempotencyKey })).toMatchObject({
        providerReference: result.providerReference,
      });
    }
  });
});
