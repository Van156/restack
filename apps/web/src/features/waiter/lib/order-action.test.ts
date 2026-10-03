import { describe, expect, test } from "bun:test";

import { runOnline, serverIdOf, type OrderAction, type OrdersApi } from "./order-action";

function fakeApi() {
  const calls: [string, unknown][] = [];
  const record = (name: string) => async (input: unknown) => {
    calls.push([name, input]);
    return {};
  };
  const api = {
    openSession: record("openSession"),
    addLine: record("addLine"),
    removeLine: record("removeLine"),
    voidLine: record("voidLine"),
    sendToKitchen: record("sendToKitchen"),
    moveSession: record("moveSession"),
    requestBill: record("requestBill"),
    applyDiscount: record("applyDiscount"),
  } as unknown as OrdersApi;
  return { api, calls };
}

const session = { sessionId: "s1" };

describe("serverIdOf", () => {
  test("reads a server id and gives null for a queued key", () => {
    expect(serverIdOf({ sessionId: "s1" })).toBe("s1");
    expect(serverIdOf({ lineId: "l1" })).toBe("l1");
    expect(serverIdOf({ sessionKey: "k" })).toBeNull();
    expect(serverIdOf({ lineKey: "k" })).toBeNull();
  });
});

describe("runOnline", () => {
  test("opens a session with the Location and the acting token", async () => {
    const { api, calls } = fakeApi();
    await runOnline(api, "loc1", { type: "open_session", tableId: "t1", key: "k" }, "tok");
    expect(calls).toEqual([
      ["openSession", { locationId: "loc1", tableId: "t1", actingToken: "tok" }],
    ]);
  });

  test("adds a line with its idempotency key and no client price", async () => {
    const { api, calls } = fakeApi();
    const action: OrderAction = {
      type: "add_line",
      session,
      key: "k1",
      menuItemId: "m1",
      quantity: 2,
      modifierIds: ["mod1"],
      note: "sin sal",
      unitPrice: 18_000,
      modifiers: [{ modifierId: "mod1", priceDelta: 0 }],
    };
    await runOnline(api, "loc1", action, undefined);
    expect(calls).toEqual([
      [
        "addLine",
        {
          tableSessionId: "s1",
          menuItemId: "m1",
          quantity: 2,
          modifierIds: ["mod1"],
          note: "sin sal",
          idempotencyKey: "k1",
          actingToken: undefined,
        },
      ],
    ]);
  });

  test("voids a sent line with the Override and removes an unsent one without", async () => {
    const { api, calls } = fakeApi();
    await runOnline(
      api,
      "loc1",
      { type: "void_line", line: { lineId: "l1" }, key: "k2", overrideId: "ov1" },
      "tok",
    );
    await runOnline(api, "loc1", { type: "remove_line", line: { lineId: "l2" }, key: "k3" }, "tok");
    expect(calls).toEqual([
      ["voidLine", { lineId: "l1", overrideId: "ov1", idempotencyKey: "k2", actingToken: "tok" }],
      ["removeLine", { lineId: "l2", idempotencyKey: "k3", actingToken: "tok" }],
    ]);
  });

  test("sends, moves, requests the bill and applies a discount on the session", async () => {
    const { api, calls } = fakeApi();
    await runOnline(api, "loc1", { type: "send_to_kitchen", session }, "tok");
    await runOnline(api, "loc1", { type: "move_session", session, tableId: "t2", key: "m" }, "tok");
    await runOnline(api, "loc1", { type: "request_bill", session }, "tok");
    await runOnline(
      api,
      "loc1",
      { type: "discount", session, kind: "percent", value: 10, overrideId: "ov2" },
      "tok",
    );
    expect(calls.map(([name]) => name)).toEqual([
      "sendToKitchen",
      "moveSession",
      "requestBill",
      "applyDiscount",
    ]);
    expect(calls[3]?.[1]).toEqual({
      tableSessionId: "s1",
      kind: "percent",
      value: 10,
      overrideId: "ov2",
      actingToken: "tok",
    });
  });
});
