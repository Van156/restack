import { describe, expect, test } from "bun:test";

import type { QueueRecord } from "@/features/offline-queue";

import type { FloorSession } from "./floor-plan";
import { buildOrderView, type ServerLine } from "./order-view";
import { menuIndex, overlayQueuedSessions, sessionKeysFor } from "./queued-view";

function record(
  overrides: Partial<QueueRecord> & Pick<QueueRecord, "kind" | "payload">,
): QueueRecord {
  return {
    idempotencyKey: "k",
    deviceRecordedAt: "2026-10-03T20:00:00.000Z",
    status: "pending",
    attempts: 0,
    nextAttemptAt: "2026-10-03T20:00:00.000Z",
    ...overrides,
  };
}

const serverSession: FloorSession = {
  ref: { sessionId: "s1" },
  tableId: "t1",
  status: "open",
  hasReadyTicket: false,
};

describe("overlayQueuedSessions", () => {
  test("a Table opened offline shows as occupied under its key", () => {
    const result = overlayQueuedSessions(
      [],
      [record({ kind: "open_session", idempotencyKey: "open1", payload: { tableId: "t2" } })],
    );
    expect(result).toEqual([
      { ref: { sessionKey: "open1" }, tableId: "t2", status: "open", hasReadyTicket: false },
    ]);
  });

  test("an offline opening on a Table the server already has open adds nothing (it merges)", () => {
    const result = overlayQueuedSessions(
      [serverSession],
      [record({ kind: "open_session", idempotencyKey: "open1", payload: { tableId: "t1" } })],
    );
    expect(result).toEqual([serverSession]);
  });

  test("a queued move places the session on its new Table", () => {
    const result = overlayQueuedSessions(
      [serverSession],
      [
        record({
          kind: "move_session",
          idempotencyKey: "mv1",
          payload: { tableSessionId: "s1", tableId: "t9" },
        }),
      ],
    );
    expect(result[0]?.tableId).toBe("t9");
  });

  test("a queued move of a session opened offline follows its key", () => {
    const result = overlayQueuedSessions(
      [],
      [
        record({ kind: "open_session", idempotencyKey: "open1", payload: { tableId: "t2" } }),
        record({
          kind: "move_session",
          idempotencyKey: "mv1",
          payload: { sessionKey: "open1", tableId: "t3" },
        }),
      ],
    );
    expect(result.map((session) => session.tableId)).toEqual(["t3"]);
  });

  test("synced and rejected records change nothing", () => {
    const result = overlayQueuedSessions(
      [],
      [
        record({
          kind: "open_session",
          idempotencyKey: "a",
          status: "synced",
          payload: { tableId: "t2" },
        }),
        record({
          kind: "open_session",
          idempotencyKey: "b",
          status: "rejected",
          payload: { tableId: "t3" },
        }),
      ],
    );
    expect(result).toEqual([]);
  });
});

describe("sessionKeysFor", () => {
  const records = [
    record({
      kind: "open_session",
      idempotencyKey: "open1",
      status: "synced",
      payload: { tableId: "t1" },
      result: { entityId: "s1" },
    }),
  ];

  test("a session opened offline is named by its own key", () => {
    expect(sessionKeysFor({ sessionKey: "open1" }, "t2", [])).toEqual(["open1"]);
  });

  test("a synced session keeps the keys of the records that opened it", () => {
    expect(sessionKeysFor({ sessionId: "s1" }, "t1", records)).toEqual(["open1"]);
  });

  test("a server session also owns the key of a pending opening on its Table (merge)", () => {
    const pending = record({
      kind: "open_session",
      idempotencyKey: "open2",
      payload: { tableId: "t1" },
    });
    expect(sessionKeysFor({ sessionId: "s1" }, "t1", [pending])).toEqual(["open2"]);
  });
});

const menu = menuIndex([
  {
    id: "c1",
    name: "Platos",
    items: [
      {
        id: "m1",
        name: "Bandeja",
        price: 25_000,
        active: true,
        soldOut: false,
        modifierGroups: [
          {
            id: "g1",
            name: "Punto",
            minSelect: 0,
            maxSelect: 1,
            modifiers: [{ id: "mod1", name: "Medio", priceDelta: 0 }],
          },
        ],
      },
    ],
  },
]);

const serverLine = (overrides: Partial<ServerLine> = {}): ServerLine => ({
  id: "l1",
  idempotencyKey: "k-server",
  itemName: "Jugo",
  unitPrice: 6_000,
  quantity: 1,
  modifiers: [],
  note: null,
  voided: false,
  ticketId: null,
  ...overrides,
});

const queuedLine = (overrides: Partial<QueueRecord> = {}) =>
  record({
    kind: "order_line",
    idempotencyKey: "k-queued",
    payload: {
      tableSessionId: "s1",
      menuItemId: "m1",
      quantity: 2,
      unitPrice: 25_000,
      modifiers: [{ modifierId: "mod1", priceDelta: 1_000 }],
      note: "sin ají",
    },
    ...overrides,
  });

const overlay = (records: QueueRecord[]) => ({
  records,
  sessionId: "s1",
  sessionKeys: [] as string[],
  menu,
});

describe("buildOrderView with queued records", () => {
  test("adds a queued line as unsent at the price recorded on the device", () => {
    const view = buildOrderView([serverLine()], overlay([queuedLine()]));
    expect(view.lines[1]).toMatchObject({
      id: "k-queued",
      ref: { lineKey: "k-queued" },
      name: "Bandeja",
      modifiers: ["Medio"],
      note: "sin ají",
      state: "unsent",
      pending: "queued",
      total: 52_000,
    });
    expect(view.total).toBe(58_000);
  });

  test("shows the server's line, not the queued one, once the key has synced", () => {
    const view = buildOrderView(
      [serverLine({ idempotencyKey: "k-queued" })],
      overlay([queuedLine()]),
    );
    expect(view.lines).toHaveLength(1);
    expect(view.lines[0]?.pending).toBeNull();
  });

  test("a line queued for another session is left out", () => {
    const other = queuedLine({
      payload: { tableSessionId: "s2", menuItemId: "m1", quantity: 1, unitPrice: 1, modifiers: [] },
    });
    expect(buildOrderView([], overlay([other])).lines).toEqual([]);
  });

  test("a line queued under a session key of this session is included", () => {
    const keyed = queuedLine({
      payload: {
        sessionKey: "open1",
        menuItemId: "m1",
        quantity: 1,
        unitPrice: 25_000,
        modifiers: [],
      },
    });
    const view = buildOrderView([], {
      ...overlay([keyed]),
      sessionId: null,
      sessionKeys: ["open1"],
    });
    expect(view.lines).toHaveLength(1);
  });

  test("a queued void of an unsent line removes it from the order", () => {
    const view = buildOrderView(
      [serverLine()],
      overlay([record({ kind: "void", idempotencyKey: "v1", payload: { lineId: "l1" } })]),
    );
    expect(view.lines[0]?.state).toBe("voided");
    expect(view.total).toBe(0);
  });

  test("a queued void of a queued line removes it too", () => {
    const view = buildOrderView(
      [],
      overlay([
        queuedLine(),
        record({ kind: "void", idempotencyKey: "v1", payload: { lineKey: "k-queued" } }),
      ]),
    );
    expect(view.lines[0]?.state).toBe("voided");
  });

  test("a queued void of a sent line waits for an Override, then for the sync", () => {
    const sent = serverLine({ ticketId: "tk1" });
    const waiting = buildOrderView(
      [sent],
      overlay([record({ kind: "void", idempotencyKey: "v1", payload: { lineId: "l1" } })]),
    );
    expect(waiting.lines[0]).toMatchObject({
      state: "sent",
      pending: "void_needs_override",
      voidKey: "v1",
    });
    expect(waiting.total).toBe(6_000);
    const authorized = buildOrderView(
      [sent],
      overlay([
        record({
          kind: "void",
          idempotencyKey: "v1",
          payload: { lineId: "l1" },
          overrideId: "ov1",
        }),
      ]),
    );
    expect(authorized.lines[0]?.pending).toBe("void_queued");
  });

  test("rejected and synced records are not applied to the view", () => {
    const view = buildOrderView(
      [],
      overlay([
        queuedLine({ status: "rejected" }),
        queuedLine({ idempotencyKey: "z", status: "synced" }),
      ]),
    );
    expect(view.lines).toEqual([]);
  });
});
