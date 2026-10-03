import { describe, expect, test } from "bun:test";

import { MINUTE_MS } from "./test-support";
import { ContingencyBlockedError, InvalidRecordError, openOfflineQueue } from "./queue";
import { HOUR_MS, fakeClock, memoryStorage, sequentialKeys, unusedTransport } from "./test-support";

async function setup(initial = memoryStorage()) {
  const clock = fakeClock();
  const queue = await openOfflineQueue({
    storage: initial,
    clock,
    transport: unusedTransport,
    newKey: sequentialKeys(),
  });
  return { clock, queue, storage: initial };
}

const line = (extra: Record<string, unknown> = {}) => ({
  kind: "order_line" as const,
  payload: { sessionKey: "s1", menuItemId: "m1", quantity: 1, unitPrice: 18000, ...extra },
});

describe("enqueue", () => {
  test("appends in order with a generated key, the device time and a pending status", async () => {
    const { queue, clock } = await setup();
    const first = await queue.enqueue(line());
    clock.advance(MINUTE_MS);
    const second = await queue.enqueue(line());
    expect(first).toMatchObject({
      idempotencyKey: "key-1",
      kind: "order_line",
      status: "pending",
      attempts: 0,
      deviceRecordedAt: "2026-10-03T12:00:00.000Z",
      nextAttemptAt: "2026-10-03T12:00:00.000Z",
    });
    expect(queue.list().map((record) => record.idempotencyKey)).toEqual([
      "key-1",
      second.idempotencyKey,
    ]);
    expect(second.deviceRecordedAt).toBe("2026-10-03T12:01:00.000Z");
  });

  test("a caller key is kept and a repeated key never overwrites the stored record", async () => {
    const { queue } = await setup();
    const first = await queue.enqueue({ ...line(), idempotencyKey: "mine" });
    const again = await queue.enqueue({ ...line({ quantity: 9 }), idempotencyKey: "mine" });
    expect(again).toEqual(first);
    expect(queue.list()).toHaveLength(1);
    expect(queue.list()[0]?.payload.quantity).toBe(1);
  });

  test("keeps the recorded Menu price and never re-prices", async () => {
    const { queue } = await setup();
    await queue.enqueue(
      line({ unitPrice: 18000, modifiers: [{ modifierId: "x", priceDelta: 2000 }] }),
    );
    expect(queue.list()[0]?.payload).toMatchObject({
      unitPrice: 18000,
      modifiers: [{ modifierId: "x", priceDelta: 2000 }],
    });
  });

  test("refuses an order line without a recorded price", async () => {
    const { queue } = await setup();
    await expect(
      queue.enqueue({ kind: "order_line", payload: { sessionKey: "s1", menuItemId: "m1" } }),
    ).rejects.toBeInstanceOf(InvalidRecordError);
    await expect(
      queue.enqueue({ kind: "order_line", payload: { unitPrice: 12.5 } }),
    ).rejects.toBeInstanceOf(InvalidRecordError);
  });

  test("refuses an unknown kind", async () => {
    const { queue } = await setup();
    await expect(queue.enqueue({ kind: "discount" as never, payload: {} })).rejects.toBeInstanceOf(
      InvalidRecordError,
    );
  });

  test("offline payments carry the offline flag and the reference rules", async () => {
    const { queue } = await setup();
    const cash = await queue.enqueue({
      kind: "payment",
      payload: { sessionKey: "s1", tender: "cash", amount: 20000, tendered: 50000 },
    });
    expect(cash.payload.registeredOffline).toBe(true);
    await expect(
      queue.enqueue({
        kind: "payment",
        payload: { sessionKey: "s1", tender: "card", amount: 5000 },
      }),
    ).rejects.toBeInstanceOf(InvalidRecordError);
    const card = await queue.enqueue({
      kind: "takings",
      payload: { sessionKey: "s1", tender: "card", amount: 5000, reference: "A-1" },
    });
    expect(card.payload.registeredOffline).toBe(true);
  });

  test("a document request defaults to a contingency document and keeps the original sale time", async () => {
    const { queue } = await setup();
    const record = await queue.enqueue({
      kind: "document_request",
      payload: { sessionKey: "s1" },
      deviceRecordedAt: new Date("2026-10-03T09:30:00.000Z"),
    });
    expect(record.payload.contingency).toBe(true);
    expect(record.deviceRecordedAt).toBe("2026-10-03T09:30:00.000Z");
  });

  test("stored records are copies: mutating a listed record changes nothing", async () => {
    const { queue } = await setup();
    await queue.enqueue(line());
    const listed = queue.list()[0]!;
    listed.payload.unitPrice = 1;
    listed.status = "synced";
    expect(queue.list()[0]).toMatchObject({ status: "pending", payload: { unitPrice: 18000 } });
  });
});

describe("markSynced, markFailed and retry", () => {
  test("markSynced closes the record and keeps it listed", async () => {
    const { queue, clock } = await setup();
    await queue.enqueue(line());
    clock.advance(MINUTE_MS);
    await queue.markSynced("key-1", { entityId: "line_9", note: "merged" });
    expect(queue.get("key-1")).toMatchObject({
      status: "synced",
      nextAttemptAt: null,
      syncedAt: "2026-10-03T12:01:00.000Z",
      result: { entityId: "line_9", note: "merged" },
    });
  });

  test("markFailed keeps the record and schedules the next attempt with backoff", async () => {
    const { queue, clock } = await setup();
    await queue.enqueue(line());
    await queue.markFailed("key-1", { code: "NETWORK", message: "offline" });
    expect(queue.get("key-1")).toMatchObject({
      status: "failed",
      attempts: 1,
      lastError: { code: "NETWORK", message: "offline" },
      nextAttemptAt: "2026-10-03T12:01:00.000Z",
    });
    clock.advance(MINUTE_MS);
    await queue.markFailed("key-1", { code: "NETWORK", message: "offline" });
    expect(queue.get("key-1")).toMatchObject({
      attempts: 2,
      nextAttemptAt: "2026-10-03T12:03:00.000Z",
    });
  });

  test("retry makes a failed or rejected record due now and keeps its attempts", async () => {
    const { queue, clock } = await setup();
    await queue.enqueue(line());
    await queue.markFailed("key-1", { code: "NETWORK", message: "x" });
    clock.advance(1000);
    await queue.retry("key-1");
    expect(queue.get("key-1")).toMatchObject({
      status: "pending",
      attempts: 1,
      nextAttemptAt: "2026-10-03T12:00:01.000Z",
    });
  });

  test("a synced record cannot be failed or retried", async () => {
    const { queue } = await setup();
    await queue.enqueue(line());
    await queue.markSynced("key-1");
    await expect(queue.markFailed("key-1", { code: "X", message: "x" })).rejects.toThrow();
    await expect(queue.retry("key-1")).rejects.toThrow();
  });

  test("an unknown key is an error", async () => {
    const { queue } = await setup();
    await expect(queue.markSynced("nope")).rejects.toThrow("nope");
  });
});

describe("offline window", () => {
  test("derives the duration, alerts and the block from the injected clock", async () => {
    const { queue, clock } = await setup();
    expect(queue.offlineState()).toMatchObject({ online: true, durationMs: 0 });
    await queue.reportOffline();
    clock.advance(24 * HOUR_MS);
    expect(queue.offlineState()).toMatchObject({ alert: "warn_24h", contingencyBlocked: false });
    clock.advance(16 * HOUR_MS);
    expect(queue.offlineState()).toMatchObject({ alert: "warn_40h", contingencyBlocked: false });
    clock.advance(8 * HOUR_MS);
    expect(queue.offlineState()).toMatchObject({
      durationMs: 48 * HOUR_MS,
      contingencyBlocked: true,
    });
  });

  test("blocks contingency sales at 48 h but never orders, voids or Table work", async () => {
    const { queue, clock } = await setup();
    await queue.reportOffline();
    clock.advance(48 * HOUR_MS);
    await expect(
      queue.enqueue({ kind: "payment", payload: { sessionKey: "s", tender: "cash", amount: 1 } }),
    ).rejects.toBeInstanceOf(ContingencyBlockedError);
    await expect(
      queue.enqueue({ kind: "takings", payload: { sessionKey: "s", tender: "cash", amount: 1 } }),
    ).rejects.toBeInstanceOf(ContingencyBlockedError);
    await expect(
      queue.enqueue({ kind: "document_request", payload: { sessionKey: "s" } }),
    ).rejects.toBeInstanceOf(ContingencyBlockedError);
    await queue.enqueue(line());
    await queue.enqueue({ kind: "void", payload: { lineKey: "k" } });
    await queue.enqueue({ kind: "open_session", payload: { tableId: "t1" } });
    await queue.enqueue({ kind: "move_session", payload: { sessionKey: "s", tableId: "t2" } });
    expect(queue.list()).toHaveLength(4);
  });

  test("going back online ends the window and lifts the block", async () => {
    const { queue, clock } = await setup();
    await queue.reportOffline();
    clock.advance(50 * HOUR_MS);
    await queue.reportOnline();
    expect(queue.offlineState()).toMatchObject({ online: true, contingencyBlocked: false });
    await queue.enqueue({
      kind: "payment",
      payload: { sessionKey: "s", tender: "cash", amount: 1 },
    });
  });

  test("a repeated offline report keeps the original start", async () => {
    const { queue, clock } = await setup();
    await queue.reportOffline();
    clock.advance(HOUR_MS);
    await queue.reportOffline();
    expect(queue.offlineState().durationMs).toBe(HOUR_MS);
  });
});

describe("incident record", () => {
  test("records start and end of each offline window", async () => {
    const { queue, clock } = await setup();
    await queue.reportOffline();
    expect(queue.incidents()).toEqual([{ startedAt: "2026-10-03T12:00:00.000Z", endedAt: null }]);
    clock.advance(2 * HOUR_MS);
    await queue.reportOnline();
    clock.advance(HOUR_MS);
    await queue.reportOffline();
    expect(queue.incidents()).toEqual([
      { startedAt: "2026-10-03T12:00:00.000Z", endedAt: "2026-10-03T14:00:00.000Z" },
      { startedAt: "2026-10-03T15:00:00.000Z", endedAt: null },
    ]);
  });

  test("an online report with no open window records nothing", async () => {
    const { queue } = await setup();
    await queue.reportOnline();
    expect(queue.incidents()).toEqual([]);
  });
});

describe("persistence", () => {
  test("a reopened queue has the same records, incidents and offline window", async () => {
    const storage = memoryStorage();
    const first = await setup(storage);
    await first.queue.reportOffline();
    await first.queue.enqueue(line());
    await first.queue.markFailed("key-1", { code: "NETWORK", message: "x" });

    const clock = fakeClock("2026-10-04T12:00:00.000Z");
    const reopened = await openOfflineQueue({ storage, clock, transport: unusedTransport });
    expect(reopened.list()).toEqual(first.queue.list());
    expect(reopened.incidents()).toEqual(first.queue.incidents());
    expect(reopened.offlineState().durationMs).toBe(24 * HOUR_MS);
  });

  test("a failed save rejects the mutation", async () => {
    const { queue, storage } = await setup();
    storage.failNextSave();
    await expect(queue.enqueue(line())).rejects.toThrow("disk full");
  });
});
