import { describe, expect, test } from "bun:test";

import { AlegraInvoicingProvider } from "./alegra-provider";
import { createInvoicingProvider } from "./factory";
import { RecordingInvoicingProvider } from "./recording-provider";
import { InvoicingNotConfiguredError } from "./types";

const credentials = { ALEGRA_EMAIL: "ops@example.com", ALEGRA_TOKEN: "token" };

describe("createInvoicingProvider", () => {
  test("uses the recording fake in development and test without credentials", () => {
    expect(createInvoicingProvider({ NODE_ENV: "development" })).toBeInstanceOf(
      RecordingInvoicingProvider,
    );
    expect(createInvoicingProvider({ NODE_ENV: "test" })).toBeInstanceOf(
      RecordingInvoicingProvider,
    );
  });

  test("production uses Alegra whenever credentials are present", () => {
    expect(createInvoicingProvider({ NODE_ENV: "production", ...credentials })).toBeInstanceOf(
      AlegraInvoicingProvider,
    );
  });

  test("outside production credentials alone never select real Alegra", () => {
    for (const NODE_ENV of ["development", "test"] as const) {
      expect(createInvoicingProvider({ NODE_ENV, ...credentials })).toBeInstanceOf(
        RecordingInvoicingProvider,
      );
      expect(
        createInvoicingProvider({ NODE_ENV, INVOICING_PROVIDER: "fake", ...credentials }),
      ).toBeInstanceOf(RecordingInvoicingProvider);
    }
  });

  test("outside production INVOICING_PROVIDER=alegra opts in to real Alegra", () => {
    expect(
      createInvoicingProvider({
        NODE_ENV: "development",
        INVOICING_PROVIDER: "alegra",
        ...credentials,
      }),
    ).toBeInstanceOf(AlegraInvoicingProvider);
  });

  test("production refuses the fake even when it is asked for explicitly", () => {
    expect(() =>
      createInvoicingProvider({ NODE_ENV: "production", INVOICING_PROVIDER: "fake" }),
    ).toThrow(/fake/i);
    expect(() =>
      createInvoicingProvider({
        NODE_ENV: "production",
        INVOICING_PROVIDER: "fake",
        ...credentials,
      }),
    ).toThrow(/fake/i);
  });

  test("production without credentials never falls back to the fake and fails on use", async () => {
    const provider = createInvoicingProvider({ NODE_ENV: "production" });
    expect(provider).not.toBeInstanceOf(RecordingInvoicingProvider);
    const call = provider.issueDocument({
      idempotencyKey: "k",
      kind: "pos_equivalent",
      connection: { companyReference: "c", numberingPrefix: null },
      saleTime: new Date(),
      contingency: false,
      buyer: { kind: "consumidor_final" },
      lines: [],
      tip: 0,
      total: 0,
    });
    await expect(call).rejects.toBeInstanceOf(InvoicingNotConfiguredError);
  });

  test("asking for Alegra without credentials is a startup error in every environment", () => {
    expect(() =>
      createInvoicingProvider({ NODE_ENV: "development", INVOICING_PROVIDER: "alegra" }),
    ).toThrow(/ALEGRA_EMAIL/);
  });

  test("setting only one Alegra credential is a startup error", () => {
    expect(() => createInvoicingProvider({ NODE_ENV: "test", ALEGRA_EMAIL: "a@b.co" })).toThrow(
      /ALEGRA_TOKEN/,
    );
  });
});
