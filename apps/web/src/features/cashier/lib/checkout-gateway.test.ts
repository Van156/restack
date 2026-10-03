import { describe, expect, test } from "bun:test";

import {
  OfflineRequiredError,
  OnlineSwitchInRequiredError,
  type EnqueueInput,
} from "@/features/offline-queue";

import type { CheckoutAction, CheckoutApi } from "./checkout-actions";
import { executeCheckoutAction, settlesBill, toQueueInput } from "./checkout-gateway";

const now = new Date("2026-10-03T20:00:00.250Z");
const bill = { status: "open", balanceDue: 30_000, lineCount: 2 } as const;

const payment = (
  amount: number,
  over: Partial<Extract<CheckoutAction, { type: "payment" }>> = {},
) =>
  ({
    type: "payment",
    sessionId: "s1",
    key: "k1",
    payment: { tender: "cash", amount, tendered: amount + 2_000 },
    ...over,
  }) as CheckoutAction;

const signer = {
  sign: async (record: { idempotencyKey: string; kind: string; deviceRecordedAt: Date }) => ({
    memberId: "mem1",
    epoch: 1,
    mac: `${record.idempotencyKey}|${record.kind}`,
  }),
};

function setup(
  over: {
    online?: boolean;
    failWith?: unknown;
    actor?: { token?: string; signer?: typeof signer };
    bill?: { status: "open" | "settled" | "reopened"; balanceDue: number; lineCount: number };
  } = {},
) {
  const calls: string[] = [];
  const queued: EnqueueInput[] = [];
  const outcomes: string[] = [];
  const respond = (name: string) => async () => {
    calls.push(name);
    if (over.failWith) {
      throw over.failWith;
    }
    return { name };
  };
  const api = {
    billing: {
      setTip: respond("setTip"),
      removeTip: respond("removeTip"),
      recordPayment: respond("recordPayment"),
      settle: respond("settle"),
      reopen: respond("reopen"),
    },
    orders: { applyDiscount: respond("applyDiscount"), voidLine: respond("voidLine") },
    dian: { issueDocument: respond("issueDocument"), retryDocument: respond("retryDocument") },
  } as unknown as CheckoutApi;
  const deps = {
    api,
    actor: over.actor ?? {},
    clock: { now: () => now },
    online: over.online ?? true,
    bill: over.bill ?? bill,
    enqueue: async (input: EnqueueInput) => void queued.push(input),
    onRequest: (outcome: "ok" | "network_failure") => void outcomes.push(outcome),
  };
  return { deps, calls, queued, outcomes };
}

describe("settlesBill", () => {
  test("a payment for the whole balance of a Bill with lines closes it", () => {
    expect(settlesBill(bill, 30_000)).toBe(true);
    expect(settlesBill(bill, 10_000)).toBe(false);
    expect(settlesBill({ ...bill, status: "settled" }, 30_000)).toBe(false);
    expect(settlesBill({ ...bill, lineCount: 0 }, 30_000)).toBe(false);
  });
});

describe("toQueueInput", () => {
  test("a payment becomes a payment record with its own key and the tender data", () => {
    expect(toQueueInput(payment(10_000), bill)).toEqual({
      kind: "payment",
      idempotencyKey: "k1",
      payload: { tableSessionId: "s1", tender: "cash", amount: 10_000, tendered: 12_000 },
    });
  });

  test("the payment that covers the balance carries the settle flag", () => {
    expect(toQueueInput(payment(30_000), bill)?.payload.settle).toBe(true);
  });

  test("a card payment keeps its reference", () => {
    const action = payment(10_000, {
      payment: { tender: "card", amount: 10_000, reference: "0045" },
    });
    expect(toQueueInput(action, bill)?.payload).toEqual({
      tableSessionId: "s1",
      tender: "card",
      amount: 10_000,
      reference: "0045",
    });
  });

  test("a POS document request keeps the original sale time and is a contingency document", () => {
    expect(
      toQueueInput(
        {
          type: "issue_document",
          sessionId: "s1",
          kind: "pos_equivalent",
          saleTime: "2026-10-03T18:30:00.000Z",
        },
        bill,
      ),
    ).toEqual({
      kind: "document_request",
      idempotencyKey: "document_request:s1:pos_equivalent",
      payload: { tableSessionId: "s1", kind: "pos_equivalent", contingency: true },
      deviceRecordedAt: "2026-10-03T18:30:00.000Z",
    });
  });

  test("a factura, a tip, a settle and the Override actions cannot wait in the queue", () => {
    const cannot: CheckoutAction[] = [
      { type: "issue_document", sessionId: "s1", kind: "factura", buyerId: "b1" },
      { type: "set_tip", sessionId: "s1", amount: 1 },
      { type: "remove_tip", sessionId: "s1" },
      { type: "settle", sessionId: "s1" },
      { type: "reopen", sessionId: "s1", overrideId: "o" },
      { type: "discount", sessionId: "s1", kind: "amount", value: 1, overrideId: "o" },
      { type: "void_line", lineId: "l", key: "k", overrideId: "o" },
      { type: "retry_document", documentId: "d" },
    ];
    for (const action of cannot) {
      expect(toQueueInput(action, bill)).toBeNull();
    }
  });
});

describe("executeCheckoutAction", () => {
  test("online, calls the procedure and queues nothing", async () => {
    const { deps, calls, queued, outcomes } = setup();
    expect(await executeCheckoutAction(deps, payment(10_000))).toEqual({
      result: "applied",
      data: { name: "recordPayment" },
    });
    expect(calls).toEqual(["recordPayment"]);
    expect(queued).toEqual([]);
    expect(outcomes).toEqual(["ok"]);
  });

  test("offline, queues the payment without calling the server", async () => {
    const { deps, calls, queued } = setup({ online: false });
    expect(await executeCheckoutAction(deps, payment(10_000))).toEqual({ result: "queued" });
    expect(calls).toEqual([]);
    expect(queued.map((input) => input.idempotencyKey)).toEqual(["k1"]);
  });

  test("a network failure while online queues the same payment under the same key", async () => {
    const { deps, queued, outcomes } = setup({ failWith: new TypeError("Failed to fetch") });
    expect(await executeCheckoutAction(deps, payment(10_000))).toEqual({ result: "queued" });
    expect(queued[0]?.idempotencyKey).toBe("k1");
    expect(outcomes).toEqual(["network_failure"]);
  });

  test("a business refusal is rethrown, not queued, and shows the server was reached", async () => {
    const refusal = Object.assign(new Error("exceeds"), { code: "CONFLICT" });
    const { deps, queued, outcomes } = setup({ failWith: refusal });
    await expect(executeCheckoutAction(deps, payment(10_000))).rejects.toBe(refusal);
    expect(queued).toEqual([]);
    expect(outcomes).toEqual(["ok"]);
  });

  test("offline, a tip, settle, discount, void, reopen or factura needs a connection", async () => {
    const actions: CheckoutAction[] = [
      { type: "set_tip", sessionId: "s1", amount: 1 },
      { type: "settle", sessionId: "s1" },
      { type: "reopen", sessionId: "s1", overrideId: "o" },
      { type: "issue_document", sessionId: "s1", kind: "factura", buyerId: "b" },
    ];
    for (const action of actions) {
      const { deps, queued } = setup({ online: false });
      await expect(executeCheckoutAction(deps, action)).rejects.toBeInstanceOf(
        OfflineRequiredError,
      );
      expect(queued).toEqual([]);
    }
  });

  test("a member who entered the PIN offline signs queued payments, even online", async () => {
    const { deps, calls, queued } = setup({ actor: { signer } });
    await executeCheckoutAction(deps, payment(10_000));
    expect(calls).toEqual([]);
    expect(queued[0]?.offlineActor).toEqual({ memberId: "mem1", epoch: 1, mac: "k1|payment" });
    expect(queued[0]).not.toHaveProperty("actingToken");
    expect(queued[0]?.deviceRecordedAt).toEqual(now);
  });

  test("an online switch-in attributes the queued record with the acting token", async () => {
    const { deps, queued } = setup({ online: false, actor: { token: "tok" } });
    await executeCheckoutAction(deps, payment(10_000));
    expect(queued[0]?.actingToken).toBe("tok");
  });

  test("actions stored under a member are refused for a PIN entered offline", async () => {
    const actions: CheckoutAction[] = [
      { type: "set_tip", sessionId: "s1", amount: 1 },
      { type: "remove_tip", sessionId: "s1" },
      { type: "settle", sessionId: "s1" },
      { type: "reopen", sessionId: "s1", overrideId: "o" },
      { type: "discount", sessionId: "s1", kind: "amount", value: 1, overrideId: "o" },
      { type: "void_line", lineId: "l", key: "k", overrideId: "o" },
    ];
    for (const action of actions) {
      const { deps, calls } = setup({ actor: { signer } });
      await expect(executeCheckoutAction(deps, action)).rejects.toBeInstanceOf(
        OnlineSwitchInRequiredError,
      );
      expect(calls).toEqual([]);
    }
  });

  test("a POS document requested offline is queued with the sale time", async () => {
    const { deps, calls, queued } = setup({ online: false });
    const answer = await executeCheckoutAction(deps, {
      type: "issue_document",
      sessionId: "s1",
      kind: "pos_equivalent",
      saleTime: "2026-10-03T18:30:00.000Z",
    });
    expect(answer).toEqual({ result: "queued" });
    expect(calls).toEqual([]);
    expect(queued[0]?.kind).toBe("document_request");
    expect(queued[0]?.deviceRecordedAt).toBe("2026-10-03T18:30:00.000Z");
  });
});
