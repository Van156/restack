import { describe, expect, test } from "bun:test";

import { reuseAttemptKey, runCheckout, type CheckoutApi } from "./checkout-actions";

function fakeApi() {
  const calls: { name: string; input: unknown }[] = [];
  const record = (name: string) => async (input: unknown) => {
    calls.push({ name, input });
    return {};
  };
  const api = {
    billing: {
      setTip: record("setTip"),
      removeTip: record("removeTip"),
      recordPayment: record("recordPayment"),
      settle: record("settle"),
      reopen: record("reopen"),
    },
    orders: { applyDiscount: record("applyDiscount"), voidLine: record("voidLine") },
    dian: { issueDocument: record("issueDocument"), retryDocument: record("retryDocument") },
  } as unknown as CheckoutApi;
  return { api, calls };
}

describe("runCheckout", () => {
  test("a payment goes with its key, reference and acting token", async () => {
    const { api, calls } = fakeApi();
    await runCheckout(
      api,
      {
        type: "payment",
        sessionId: "s1",
        key: "k1",
        payment: { tender: "card", amount: 30_000, reference: "0045" },
      },
      "tok",
    );
    expect(calls).toEqual([
      {
        name: "recordPayment",
        input: {
          tableSessionId: "s1",
          tender: "card",
          amount: 30_000,
          tendered: undefined,
          reference: "0045",
          idempotencyKey: "k1",
          actingToken: "tok",
        },
      },
    ]);
  });

  test("tip, settle and reopen name the session and carry the acting token", async () => {
    const { api, calls } = fakeApi();
    await runCheckout(api, { type: "set_tip", sessionId: "s1", amount: 5_000 }, "tok");
    await runCheckout(api, { type: "remove_tip", sessionId: "s1" }, undefined);
    await runCheckout(api, { type: "settle", sessionId: "s1" }, "tok");
    await runCheckout(
      api,
      { type: "reopen", sessionId: "s1", overrideId: "o1", reason: "error de cobro" },
      "tok",
    );
    expect(calls.map((call) => call.name)).toEqual(["setTip", "removeTip", "settle", "reopen"]);
    expect(calls[0]!.input).toEqual({ tableSessionId: "s1", amount: 5_000, actingToken: "tok" });
    expect(calls[1]!.input).toEqual({ tableSessionId: "s1", actingToken: undefined });
    expect(calls[3]!.input).toEqual({
      tableSessionId: "s1",
      overrideId: "o1",
      reason: "error de cobro",
      actingToken: "tok",
    });
  });

  test("a discount and a void carry the Override that authorized them", async () => {
    const { api, calls } = fakeApi();
    await runCheckout(
      api,
      { type: "discount", sessionId: "s1", kind: "percent", value: 10, overrideId: "o1" },
      "tok",
    );
    await runCheckout(api, { type: "void_line", lineId: "l1", key: "k2", overrideId: "o2" }, "tok");
    expect(calls[0]).toEqual({
      name: "applyDiscount",
      input: {
        tableSessionId: "s1",
        kind: "percent",
        value: 10,
        overrideId: "o1",
        actingToken: "tok",
      },
    });
    expect(calls[1]).toEqual({
      name: "voidLine",
      input: { lineId: "l1", overrideId: "o2", idempotencyKey: "k2", actingToken: "tok" },
    });
  });

  test("a document is issued with its kind and buyer, a rejected one retried with a corrected buyer", async () => {
    const { api, calls } = fakeApi();
    await runCheckout(
      api,
      { type: "issue_document", sessionId: "s1", kind: "factura", buyerId: "b1" },
      "tok",
    );
    await runCheckout(api, { type: "retry_document", documentId: "d1", buyerId: "b2" }, undefined);
    expect(calls[0]).toEqual({
      name: "issueDocument",
      input: {
        tableSessionId: "s1",
        kind: "factura",
        buyerId: "b1",
        contingency: false,
        actingToken: "tok",
      },
    });
    expect(calls[1]).toEqual({
      name: "retryDocument",
      input: { documentId: "d1", buyerId: "b2", actingToken: undefined },
    });
  });
});

describe("reuseAttemptKey", () => {
  const payment = { tender: "cash", amount: 5_000 } as const;
  let counter = 0;
  const fresh = () => `key-${(counter += 1)}`;

  test("a new payment gets a new key", () => {
    expect(reuseAttemptKey(null, payment, fresh)).toEqual({
      fingerprint: JSON.stringify(payment),
      key: "key-1",
    });
  });

  test("retrying the same payment keeps its key, so a lost answer cannot charge twice", () => {
    const first = reuseAttemptKey(null, payment, fresh);
    expect(reuseAttemptKey(first, { ...payment }, fresh).key).toBe(first.key);
  });

  test("changing the payment starts a new attempt", () => {
    const first = reuseAttemptKey(null, payment, fresh);
    expect(reuseAttemptKey(first, { ...payment, amount: 6_000 }, fresh).key).not.toBe(first.key);
  });
});
