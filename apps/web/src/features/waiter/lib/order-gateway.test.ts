import { describe, expect, test } from "bun:test";

import type { EnqueueInput } from "@/features/offline-queue";

import { OfflineRequiredError, executeOrderAction, toQueueInput } from "./order-gateway";
import type { OrderAction, OrdersApi } from "./order-action";

const addLine: OrderAction = {
  type: "add_line",
  session: { sessionId: "s1" },
  key: "k1",
  menuItemId: "m1",
  quantity: 2,
  modifierIds: ["mod1"],
  note: "sin sal",
  unitPrice: 18_000,
  modifiers: [{ modifierId: "mod1", priceDelta: 500 }],
};

function setup(overrides: { online?: boolean; failWith?: unknown } = {}) {
  const calls: string[] = [];
  const queued: EnqueueInput[] = [];
  const outcomes: string[] = [];
  const respond = (name: string) => async () => {
    calls.push(name);
    if (overrides.failWith) {
      throw overrides.failWith;
    }
    return {};
  };
  const api = {
    openSession: respond("openSession"),
    addLine: respond("addLine"),
    removeLine: respond("removeLine"),
    voidLine: respond("voidLine"),
    sendToKitchen: respond("sendToKitchen"),
    moveSession: respond("moveSession"),
    requestBill: respond("requestBill"),
    applyDiscount: respond("applyDiscount"),
  } as unknown as OrdersApi;
  const deps = {
    api,
    locationId: "loc1",
    actingToken: "tok",
    online: overrides.online ?? true,
    enqueue: async (input: EnqueueInput) => {
      queued.push(input);
    },
    onRequest: (outcome: "ok" | "network_failure") => outcomes.push(outcome),
  };
  return { deps, calls, queued, outcomes };
}

describe("toQueueInput", () => {
  test("an order line carries the recorded price, modifier deltas and its key", () => {
    expect(toQueueInput(addLine, "tok")).toEqual({
      kind: "order_line",
      idempotencyKey: "k1",
      actingToken: "tok",
      payload: {
        tableSessionId: "s1",
        menuItemId: "m1",
        quantity: 2,
        unitPrice: 18_000,
        modifiers: [{ modifierId: "mod1", priceDelta: 500 }],
        note: "sin sal",
      },
    });
  });

  test("a line on a session opened offline names it by the opening key", () => {
    const input = toQueueInput({ ...addLine, session: { sessionKey: "open1" } }, undefined);
    expect(input?.payload).toMatchObject({ sessionKey: "open1" });
    expect(input?.payload).not.toHaveProperty("tableSessionId");
    expect(input).not.toHaveProperty("actingToken");
  });

  test("opening a Table queues the session key and the Table", () => {
    expect(toQueueInput({ type: "open_session", tableId: "t1", key: "open1" }, "tok")).toEqual({
      kind: "open_session",
      idempotencyKey: "open1",
      actingToken: "tok",
      payload: { tableId: "t1" },
    });
  });

  test("a void names the line by id or by key and keeps the Override when there is one", () => {
    expect(
      toQueueInput({ type: "void_line", line: { lineId: "l1" }, key: "v1" }, undefined)?.payload,
    ).toEqual({ lineId: "l1" });
    expect(
      toQueueInput({ type: "remove_line", line: { lineKey: "k9" }, key: "v2" }, undefined)?.payload,
    ).toEqual({ lineKey: "k9" });
    expect(
      toQueueInput(
        { type: "void_line", line: { lineId: "l1" }, key: "v3", overrideId: "ov1" },
        undefined,
      )?.payload,
    ).toEqual({ lineId: "l1", overrideId: "ov1" });
  });

  test("a move queues the destination Table", () => {
    expect(
      toQueueInput(
        { type: "move_session", session: { sessionId: "s1" }, tableId: "t2", key: "mv1" },
        undefined,
      ),
    ).toEqual({
      kind: "move_session",
      idempotencyKey: "mv1",
      payload: { tableSessionId: "s1", tableId: "t2" },
    });
  });

  test("sending to the kitchen, the bill and discounts are not queueable", () => {
    const session = { sessionId: "s1" };
    expect(toQueueInput({ type: "send_to_kitchen", session }, undefined)).toBeNull();
    expect(toQueueInput({ type: "request_bill", session }, undefined)).toBeNull();
    expect(
      toQueueInput(
        { type: "discount", session, kind: "amount", value: 100, overrideId: "o" },
        undefined,
      ),
    ).toBeNull();
  });
});

describe("executeOrderAction", () => {
  test("online, calls the procedure and queues nothing", async () => {
    const { deps, calls, queued, outcomes } = setup();
    expect(await executeOrderAction(deps, addLine)).toBe("applied");
    expect(calls).toEqual(["addLine"]);
    expect(queued).toEqual([]);
    expect(outcomes).toEqual(["ok"]);
  });

  test("offline, queues the record without calling the server", async () => {
    const { deps, calls, queued } = setup({ online: false });
    expect(await executeOrderAction(deps, addLine)).toBe("queued");
    expect(calls).toEqual([]);
    expect(queued.map((input) => input.idempotencyKey)).toEqual(["k1"]);
  });

  test("a network failure while online queues the same record and reports it", async () => {
    const { deps, queued, outcomes } = setup({ failWith: new TypeError("Failed to fetch") });
    expect(await executeOrderAction(deps, addLine)).toBe("queued");
    expect(queued.map((input) => input.idempotencyKey)).toEqual(["k1"]);
    expect(outcomes).toEqual(["network_failure"]);
  });

  test("a business refusal is rethrown, not queued, and shows the server was reached", async () => {
    const refusal = Object.assign(new Error("sold out"), { code: "CONFLICT" });
    const { deps, queued, outcomes } = setup({ failWith: refusal });
    await expect(executeOrderAction(deps, addLine)).rejects.toBe(refusal);
    expect(queued).toEqual([]);
    expect(outcomes).toEqual(["ok"]);
  });

  test("an action that cannot be queued needs a connection", async () => {
    const offline = setup({ online: false });
    await expect(
      executeOrderAction(offline.deps, { type: "send_to_kitchen", session: { sessionId: "s1" } }),
    ).rejects.toBeInstanceOf(OfflineRequiredError);
    const failing = setup({ failWith: new TypeError("Failed to fetch") });
    await expect(
      executeOrderAction(failing.deps, { type: "request_bill", session: { sessionId: "s1" } }),
    ).rejects.toBeInstanceOf(OfflineRequiredError);
  });

  test("anything naming an unsynced session or line is queued even when online", async () => {
    const { deps, calls, queued } = setup();
    await executeOrderAction(deps, { ...addLine, session: { sessionKey: "open1" } });
    await executeOrderAction(deps, { type: "remove_line", line: { lineKey: "k9" }, key: "v1" });
    expect(calls).toEqual([]);
    expect(queued).toHaveLength(2);
  });

  test("a void without an Override waits in the queue for one", async () => {
    const { deps, calls, queued } = setup();
    expect(
      await executeOrderAction(deps, { type: "void_line", line: { lineId: "l1" }, key: "v1" }),
    ).toBe("queued");
    expect(calls).toEqual([]);
    expect(queued[0]?.payload).toEqual({ lineId: "l1" });
  });
});
