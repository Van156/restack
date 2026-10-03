import { describe, expect, test } from "bun:test";

import { openOfflineQueue } from "./queue";
import type { EnqueueInput } from "./queue";
import {
  HOUR_MS,
  MINUTE_MS,
  fakeClock,
  memoryStorage,
  rejected,
  scriptedTransport,
  sequentialKeys,
} from "./test-support";
import type { SyncTransport } from "./types";

async function setup(transport: SyncTransport) {
  const clock = fakeClock();
  const queue = await openOfflineQueue({
    storage: memoryStorage(),
    clock,
    transport,
    newKey: sequentialKeys(),
  });
  return { clock, queue };
}

const line = (extra: Record<string, unknown> = {}): EnqueueInput => ({
  kind: "order_line",
  payload: { tableSessionId: "ts1", menuItemId: "m1", quantity: 1, unitPrice: 18000, ...extra },
});
const keys = (records: { idempotencyKey: string }[]) => records.map((r) => r.idempotencyKey);
const ok = scriptedTransport(() => ({ status: "applied" }));

describe("selectBatch", () => {
  test("holds the due records in queue order with the recorded price untouched", async () => {
    const { queue } = await setup(ok);
    await queue.enqueue(line({ unitPrice: 18000 }));
    await queue.enqueue(line({ unitPrice: 9500 }));
    const batch = queue.selectBatch();
    expect(keys(batch)).toEqual(["key-1", "key-2"]);
    expect(batch.map((r) => r.payload.unitPrice)).toEqual([18000, 9500]);
    expect(batch[0]).toEqual({
      idempotencyKey: "key-1",
      kind: "order_line",
      payload: queue.get("key-1")!.payload,
      deviceRecordedAt: "2026-10-03T12:00:00.000Z",
    });
  });

  test("leaves out records that are not due yet, synced, or rejected", async () => {
    const { queue, clock } = await setup(ok);
    for (let i = 0; i < 4; i += 1) {
      await queue.enqueue(line());
    }
    await queue.markSynced("key-1");
    await queue.markFailed("key-2", { code: "NETWORK", message: "x" });
    await queue.enqueue(line());
    expect(keys(queue.selectBatch())).toEqual(["key-3", "key-4", "key-5"]);
    clock.advance(MINUTE_MS);
    expect(keys(queue.selectBatch())).toEqual(["key-2", "key-3", "key-4", "key-5"]);
  });

  test("caps a batch at the server limit", async () => {
    const { queue } = await setup(ok);
    for (let i = 0; i < 250; i += 1) {
      await queue.enqueue(line());
    }
    expect(queue.selectBatch()).toHaveLength(200);
  });

  test("a record naming a session by key goes after the opener, never before an unsent one", async () => {
    const { queue, clock } = await setup(ok);
    await queue.enqueue({
      kind: "open_session",
      payload: { tableId: "t1" },
      idempotencyKey: "open-1",
    });
    await queue.enqueue(line({ tableSessionId: undefined, sessionKey: "open-1" }));
    expect(keys(queue.selectBatch())).toEqual(["open-1", "key-1"]);

    await queue.markFailed("open-1", { code: "NETWORK", message: "x" });
    expect(queue.selectBatch()).toEqual([]);
    clock.advance(MINUTE_MS);
    expect(keys(queue.selectBatch())).toEqual(["open-1", "key-1"]);

    await queue.markSynced("open-1");
    expect(keys(queue.selectBatch())).toEqual(["key-1"]);
  });

  test("a record whose opener was rejected is held back, not sent", async () => {
    const { queue } = await setup(
      scriptedTransport((r) =>
        r.kind === "open_session"
          ? rejected("FORBIDDEN")
          : rejected("NOT_FOUND", "session_not_synced"),
      ),
    );
    await queue.enqueue({
      kind: "open_session",
      payload: { tableId: "t1" },
      idempotencyKey: "open-1",
    });
    await queue.enqueue({ kind: "move_session", payload: { sessionKey: "open-1", tableId: "t2" } });
    await queue.sync();
    expect(queue.get("open-1")?.status).toBe("rejected");
    expect(queue.selectBatch()).toEqual([]);
    expect(queue.get("key-1")).toMatchObject({ status: "waiting", waitingOn: "session" });
  });

  test("a void by line key goes after the line it names", async () => {
    const { queue } = await setup(ok);
    await queue.enqueue({ ...line(), idempotencyKey: "line-1" });
    await queue.enqueue({ kind: "void", payload: { lineKey: "line-1" } });
    await queue.markFailed("line-1", { code: "NETWORK", message: "x" });
    expect(queue.selectBatch()).toEqual([]);
  });

  test("an unknown session key is left to the server to answer", async () => {
    const { queue } = await setup(ok);
    await queue.enqueue(line({ tableSessionId: undefined, sessionKey: "from-elsewhere" }));
    expect(keys(queue.selectBatch())).toEqual(["key-1"]);
  });
});

describe("acting tokens", () => {
  test("a token is sent within 48 h and stripped from older records, which keep it stored", async () => {
    const { queue, clock } = await setup(ok);
    await queue.enqueue({ ...line(), actingToken: "tok" });
    clock.advance(48 * HOUR_MS);
    expect(queue.selectBatch()[0]?.actingToken).toBe("tok");
    clock.advance(1);
    const [wire] = queue.selectBatch();
    expect(wire).toBeDefined();
    expect("actingToken" in wire!).toBe(false);
    expect(queue.get("key-1")?.actingToken).toBe("tok");
  });
});

describe("sync result mapping", () => {
  test("applied and already_applied mark the record synced and keep the server's note", async () => {
    const transport = scriptedTransport((_, i) =>
      i === 0
        ? { status: "applied", entityId: "ln_1" }
        : { status: "already_applied", entityId: "ts_9", note: "merged" },
    );
    const { queue } = await setup(transport);
    await queue.enqueue(line());
    await queue.enqueue(line());
    const report = await queue.sync();
    expect(report).toMatchObject({ sent: 2, synced: 2 });
    expect(queue.get("key-1")).toMatchObject({ status: "synced", result: { entityId: "ln_1" } });
    expect(queue.get("key-2")).toMatchObject({
      status: "synced",
      result: { entityId: "ts_9", note: "merged" },
    });
  });

  test("results are matched by key, not by position", async () => {
    const transport: SyncTransport = {
      push: async (records) =>
        records.toReversed().map((r) => ({
          idempotencyKey: r.idempotencyKey,
          kind: r.kind,
          status: "applied" as const,
        })),
    };
    const { queue } = await setup(transport);
    await queue.enqueue(line());
    await queue.enqueue(line());
    await queue.sync();
    expect(queue.list().map((r) => r.status)).toEqual(["synced", "synced"]);
  });

  test("sends a long queue in batches until nothing is due", async () => {
    const transport = scriptedTransport(() => ({ status: "applied" }));
    const { queue } = await setup(transport);
    for (let i = 0; i < 250; i += 1) {
      await queue.enqueue(line());
    }
    const report = await queue.sync();
    expect(transport.calls.map((c) => c.length)).toEqual([200, 50]);
    expect(report.synced).toBe(250);
  });

  test("a permanent rejection keeps the record for review and is resent only by retry", async () => {
    let answer: Parameters<typeof scriptedTransport>[0] = () =>
      rejected("CONFLICT", undefined, "key reused");
    const transport = scriptedTransport((r, i) => answer(r, i));
    const { queue } = await setup(transport);
    await queue.enqueue(line());
    await queue.sync();
    expect(queue.get("key-1")).toMatchObject({
      status: "rejected",
      attempts: 1,
      nextAttemptAt: null,
      lastError: { code: "CONFLICT", message: "key reused" },
    });
    expect(await queue.sync()).toMatchObject({ sent: 0 });
    answer = () => ({ status: "applied" });
    await queue.retry("key-1");
    await queue.sync();
    expect(queue.get("key-1")?.status).toBe("synced");
  });

  test("a server hiccup fails the record with backoff and keeps retrying", async () => {
    const { queue, clock } = await setup(
      scriptedTransport(() => rejected("INTERNAL_SERVER_ERROR")),
    );
    await queue.enqueue(line());
    const waits: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      await queue.sync();
      const record = queue.get("key-1")!;
      expect(record.status).toBe("failed");
      waits.push((new Date(record.nextAttemptAt!).getTime() - clock.now().getTime()) / MINUTE_MS);
      clock.advance(new Date(record.nextAttemptAt!).getTime() - clock.now().getTime());
    }
    expect(waits).toEqual([1, 2, 4, 8, 16, 32, 60, 60]);
  });

  test("a transport failure fails every record of the batch and drops none", async () => {
    const transport: SyncTransport = {
      push: async () => {
        throw new Error("Failed to fetch");
      },
    };
    const { queue } = await setup(transport);
    await queue.enqueue(line());
    await queue.enqueue(line());
    const report = await queue.sync();
    expect(report).toMatchObject({ sent: 2, failed: 2, synced: 0 });
    expect(queue.list()).toHaveLength(2);
    expect(queue.get("key-1")).toMatchObject({
      status: "failed",
      attempts: 1,
      lastError: { code: "NETWORK", message: "Failed to fetch" },
    });
  });

  test("a record the server did not answer fails and is retried later", async () => {
    const { queue } = await setup(
      scriptedTransport((_, i) => (i === 1 ? "omit" : { status: "applied" })),
    );
    await queue.enqueue(line());
    await queue.enqueue(line());
    await queue.sync();
    expect(queue.get("key-1")?.status).toBe("synced");
    expect(queue.get("key-2")).toMatchObject({
      status: "failed",
      lastError: { code: "NO_RESULT" },
    });
  });

  test("overlapping syncs share one push", async () => {
    const transport = scriptedTransport(() => ({ status: "applied" }));
    const { queue } = await setup(transport);
    await queue.enqueue(line());
    const [a, b] = await Promise.all([queue.sync(), queue.sync()]);
    expect(transport.calls).toHaveLength(1);
    expect(a).toEqual(b);
  });
});

describe("session_not_synced", () => {
  test("waits for the opener and is resent right after it syncs", async () => {
    const transport = scriptedTransport((r) =>
      r.kind === "open_session"
        ? { status: "applied" }
        : rejected("NOT_FOUND", "session_not_synced"),
    );
    const { queue } = await setup(transport);
    await queue.enqueue({
      kind: "open_session",
      payload: { tableId: "t1" },
      idempotencyKey: "open-1",
    });
    await queue.enqueue(line({ tableSessionId: undefined, sessionKey: "open-1" }));
    await queue.sync();
    expect(queue.get("key-1")).toMatchObject({
      status: "waiting",
      waitingOn: "session",
      attempts: 1,
    });
    expect(queue.get("open-1")?.status).toBe("synced");
    expect(keys(queue.selectBatch())).toEqual(["key-1"]);
  });

  test("with no opener in the queue it waits out its backoff before asking again", async () => {
    let known = false;
    const transport = scriptedTransport(() =>
      known ? { status: "applied" } : rejected("NOT_FOUND", "session_not_synced"),
    );
    const { queue, clock } = await setup(transport);
    await queue.enqueue(line({ tableSessionId: undefined, sessionKey: "elsewhere" }));
    await queue.sync();
    expect(queue.get("key-1")).toMatchObject({ status: "waiting", waitingOn: "session" });
    expect(queue.selectBatch()).toEqual([]);
    clock.advance(MINUTE_MS);
    known = true;
    await queue.sync();
    expect(queue.get("key-1")?.status).toBe("synced");
  });
});

describe("Override-pending voids", () => {
  const voidRecord: EnqueueInput = { kind: "void", payload: { lineId: "ln_1", reason: "wrong" } };

  test("stays pending until an Override is attached, then goes out with it", async () => {
    let answer = rejected("FORBIDDEN", "override_required");
    const transport = scriptedTransport(() => answer);
    const { queue, clock } = await setup(transport);
    await queue.enqueue(voidRecord);
    await queue.sync();
    expect(queue.get("key-1")).toMatchObject({ status: "waiting", waitingOn: "override" });
    clock.advance(100 * HOUR_MS);
    expect(queue.selectBatch()).toEqual([]);

    await queue.attachOverride("key-1", "ov_1");
    const [wire] = queue.selectBatch();
    expect(wire?.payload).toEqual({ lineId: "ln_1", reason: "wrong", overrideId: "ov_1" });
    expect(queue.get("key-1")?.payload).toEqual({ lineId: "ln_1", reason: "wrong" });

    answer = { status: "applied" };
    await queue.sync();
    expect(queue.get("key-1")?.status).toBe("synced");
  });

  test("an invalid Override is discarded and the void waits for another", async () => {
    const transport = scriptedTransport(() => rejected("FORBIDDEN", "override_invalid"));
    const { queue } = await setup(transport);
    await queue.enqueue(voidRecord);
    await queue.attachOverride("key-1", "ov_old");
    await queue.sync();
    const record = queue.get("key-1")!;
    expect(record).toMatchObject({ status: "waiting", waitingOn: "override" });
    expect(record.overrideId).toBeUndefined();
    expect(queue.selectBatch()).toEqual([]);
  });

  test("an Override cannot be attached to a synced record", async () => {
    const { queue } = await setup(ok);
    await queue.enqueue(voidRecord);
    await queue.markSynced("key-1");
    await expect(queue.attachOverride("key-1", "ov_1")).rejects.toThrow();
  });
});

describe("document outbox", () => {
  test("lists contingency document requests still to send, with their original sale time", async () => {
    const { queue } = await setup(ok);
    await queue.enqueue({
      kind: "document_request",
      payload: { sessionKey: "s1" },
      deviceRecordedAt: "2026-10-03T09:30:00.000Z",
    });
    await queue.enqueue(line());
    await queue.enqueue({ kind: "document_request", payload: { sessionKey: "s2" } });
    expect(queue.documentOutbox()).toEqual([
      {
        idempotencyKey: "key-1",
        saleTime: "2026-10-03T09:30:00.000Z",
        contingency: true,
        status: "pending",
        attempts: 0,
        nextAttemptAt: "2026-10-03T12:00:00.000Z",
      },
      {
        idempotencyKey: "key-3",
        saleTime: "2026-10-03T12:00:00.000Z",
        contingency: true,
        status: "pending",
        attempts: 0,
        nextAttemptAt: "2026-10-03T12:00:00.000Z",
      },
    ]);
    await queue.markSynced("key-1");
    expect(keys(queue.documentOutbox())).toEqual(["key-3"]);
  });
});
