import { describe, expect, test } from "bun:test";

import {
  OfflineRequiredError,
  OnlineSwitchInRequiredError,
  type EnqueueInput,
  type QueueRecord,
} from "@/features/offline-queue";

import { executeOrderAction, toQueueInput } from "./order-gateway";
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

const now = new Date("2026-10-03T20:00:00.250Z");

const signer = {
  sign: async (record: { idempotencyKey: string; kind: string; deviceRecordedAt: Date }) => ({
    memberId: "mem1",
    epoch: 2,
    mac: `${record.idempotencyKey}|${record.kind}|${record.deviceRecordedAt.getTime()}`,
  }),
};

function setup(
  overrides: {
    online?: boolean;
    failWith?: unknown;
    actor?: { token?: string; signer?: typeof signer };
    records?: Pick<QueueRecord, "kind" | "payload" | "status" | "idempotencyKey" | "result">[];
  } = {},
) {
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
    actor: overrides.actor ?? { token: "tok" },
    clock: { now: () => now },
    records: (overrides.records ?? []) as QueueRecord[],
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
    expect(toQueueInput(addLine)).toEqual({
      kind: "order_line",
      idempotencyKey: "k1",
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
    const input = toQueueInput({ ...addLine, session: { sessionKey: "open1" } });
    expect(input?.payload).toMatchObject({ sessionKey: "open1" });
    expect(input?.payload).not.toHaveProperty("tableSessionId");
  });

  test("opening a Table queues the session key and the Table", () => {
    expect(toQueueInput({ type: "open_session", tableId: "t1", key: "open1" })).toEqual({
      kind: "open_session",
      idempotencyKey: "open1",
      payload: { tableId: "t1" },
    });
  });

  test("a void names the line by id or by key and keeps the Override when there is one", () => {
    expect(toQueueInput({ type: "void_line", line: { lineId: "l1" }, key: "v1" })?.payload).toEqual(
      { lineId: "l1" },
    );
    expect(
      toQueueInput({ type: "remove_line", line: { lineKey: "k9" }, key: "v2" })?.payload,
    ).toEqual({ lineKey: "k9" });
    expect(
      toQueueInput({ type: "void_line", line: { lineId: "l1" }, key: "v3", overrideId: "ov1" })
        ?.payload,
    ).toEqual({ lineId: "l1", overrideId: "ov1" });
  });

  test("a move queues the destination Table", () => {
    expect(
      toQueueInput({
        type: "move_session",
        session: { sessionId: "s1" },
        tableId: "t2",
        key: "mv1",
      }),
    ).toEqual({
      kind: "move_session",
      idempotencyKey: "mv1",
      payload: { tableSessionId: "s1", tableId: "t2" },
    });
  });

  test("sending to the kitchen queues the session under the send's own key", () => {
    expect(
      toQueueInput({ type: "send_to_kitchen", session: { sessionKey: "open1" }, key: "snd1" }),
    ).toEqual({
      kind: "send_to_kitchen",
      idempotencyKey: "snd1",
      payload: { sessionKey: "open1" },
    });
    expect(
      toQueueInput({ type: "send_to_kitchen", session: { sessionId: "s1" }, key: "snd2" })?.payload,
    ).toEqual({ tableSessionId: "s1" });
  });

  test("the bill and discounts are not queueable", () => {
    const session = { sessionId: "s1" };
    expect(toQueueInput({ type: "request_bill", session })).toBeNull();
    expect(
      toQueueInput({ type: "discount", session, kind: "amount", value: 100, overrideId: "o" }),
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
      executeOrderAction(offline.deps, { type: "request_bill", session: { sessionId: "s1" } }),
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

describe("sending to the kitchen", () => {
  const send: OrderAction = { type: "send_to_kitchen", session: { sessionId: "s1" }, key: "snd1" };
  const queuedLine = (status: QueueRecord["status"], payload: Record<string, unknown>) =>
    ({ idempotencyKey: "l1", kind: "order_line", status, payload }) as const;

  test("online with nothing queued for the session, calls the server", async () => {
    const { deps, calls, queued } = setup({
      records: [
        queuedLine("synced", { tableSessionId: "s1" }),
        queuedLine("pending", { tableSessionId: "other" }),
      ],
    });
    expect(await executeOrderAction(deps, send)).toBe("applied");
    expect(calls).toEqual(["sendToKitchen"]);
    expect(queued).toEqual([]);
  });

  test("offline, queues the send with its key", async () => {
    const { deps, calls, queued } = setup({ online: false });
    expect(await executeOrderAction(deps, send)).toBe("queued");
    expect(calls).toEqual([]);
    expect(queued[0]).toMatchObject({ kind: "send_to_kitchen", idempotencyKey: "snd1" });
  });

  test("a network failure while online queues it", async () => {
    const { deps, queued } = setup({ failWith: new TypeError("Failed to fetch") });
    expect(await executeOrderAction(deps, send)).toBe("queued");
    expect(queued).toHaveLength(1);
  });

  test("lines still waiting in the queue for this session keep the send behind them", async () => {
    const { deps, calls, queued } = setup({
      records: [queuedLine("failed", { tableSessionId: "s1" })],
    });
    expect(await executeOrderAction(deps, send)).toBe("queued");
    expect(calls).toEqual([]);
    expect(queued).toHaveLength(1);
  });

  test("lines queued under the key of the opener that already synced count for its session", async () => {
    const opener = {
      idempotencyKey: "open1",
      kind: "open_session",
      status: "synced",
      payload: {},
      result: { entityId: "s1" },
    } as const;
    const { deps, calls } = setup({
      records: [opener, queuedLine("pending", { sessionKey: "open1" })],
    });
    expect(await executeOrderAction(deps, send)).toBe("queued");
    expect(calls).toEqual([]);
  });

  test("an unrouted-items refusal online is rethrown, not queued", async () => {
    const refusal = Object.assign(new Error("No Station at this Location prepares: Flan."), {
      code: "CONFLICT",
    });
    const { deps, queued } = setup({ failWith: refusal });
    await expect(executeOrderAction(deps, send)).rejects.toBe(refusal);
    expect(queued).toEqual([]);
  });
});

describe("a member switched in with the offline PIN", () => {
  const offlineActor = { signer };
  const action: OrderAction = { ...addLine };

  test("queues even when online, so the record carries the signature and keeps the order", async () => {
    const { deps, calls, queued } = setup({ actor: offlineActor });
    expect(await executeOrderAction(deps, action)).toBe("queued");

    expect(calls).toEqual([]);
    expect(queued[0]).toMatchObject({
      idempotencyKey: "k1",
      deviceRecordedAt: now,
      offlineActor: { memberId: "mem1", epoch: 2, mac: `k1|order_line|${now.getTime()}` },
    });
    expect(queued[0]).not.toHaveProperty("actingToken");
  });

  test("sends to the kitchen through the queue too", async () => {
    const { deps, calls, queued } = setup({ actor: offlineActor });
    await executeOrderAction(deps, {
      type: "send_to_kitchen",
      session: { sessionId: "s1" },
      key: "snd1",
    });
    expect(calls).toEqual([]);
    expect(queued[0]).toMatchObject({
      kind: "send_to_kitchen",
      offlineActor: { memberId: "mem1" },
    });
  });

  test("a discount cannot be attributed offline, so it asks for an online switch-in", async () => {
    const { deps, calls } = setup({ actor: offlineActor });
    await expect(
      executeOrderAction(deps, {
        type: "discount",
        session: { sessionId: "s1" },
        kind: "amount",
        value: 100,
        overrideId: "o1",
      }),
    ).rejects.toBeInstanceOf(OnlineSwitchInRequiredError);
    expect(calls).toEqual([]);
  });

  test("the bill goes online without attribution, since it stores no member", async () => {
    const { deps, calls } = setup({ actor: offlineActor });
    await executeOrderAction(deps, { type: "request_bill", session: { sessionId: "s1" } });
    expect(calls).toEqual(["requestBill"]);
  });
});
