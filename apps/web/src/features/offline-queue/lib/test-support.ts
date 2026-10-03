import type {
  Clock,
  QueueSnapshot,
  QueueStorage,
  SyncTransport,
  WireRecord,
  WireResult,
} from "./types";

/** A clock the test moves by hand. */
export function fakeClock(start = "2026-10-03T12:00:00.000Z"): Clock & {
  advance(ms: number): void;
  set(iso: string): void;
} {
  let current = new Date(start).getTime();
  return {
    now: () => new Date(current),
    advance: (ms) => {
      current += ms;
    },
    set: (iso) => {
      current = new Date(iso).getTime();
    },
  };
}

export const HOUR_MS = 60 * 60 * 1000;
export const MINUTE_MS = 60 * 1000;

/** In-memory storage that keeps a deep copy, like a real persistence layer would. */
export function memoryStorage(initial: QueueSnapshot | null = null): QueueStorage & {
  saved(): QueueSnapshot | null;
  failNextSave(): void;
} {
  let stored = initial ? structuredClone(initial) : null;
  let failing = false;
  return {
    load: async () => (stored ? structuredClone(stored) : null),
    save: async (snapshot) => {
      if (failing) {
        failing = false;
        throw new Error("disk full");
      }
      stored = structuredClone(snapshot);
    },
    saved: () => (stored ? structuredClone(stored) : null),
    failNextSave: () => {
      failing = true;
    },
  };
}

let keyCounter = 0;
/** Deterministic idempotency keys: `key-1`, `key-2`, ... */
export function sequentialKeys(prefix = "key"): () => string {
  keyCounter = 0;
  return () => `${prefix}-${++keyCounter}`;
}

/** For tests that never push. */
export const unusedTransport: SyncTransport = {
  push: async () => {
    throw new Error("transport not expected");
  },
};

/** Transport that answers each pushed record through `answer` and remembers every call. */
export function scriptedTransport(
  answer: (record: WireRecord, index: number) => Partial<WireResult> | "omit",
): SyncTransport & { calls: WireRecord[][] } {
  const calls: WireRecord[][] = [];
  return {
    calls,
    push: async (records) => {
      calls.push(structuredClone(records));
      return records.flatMap((record, index) => {
        const reply = answer(record, index);
        return reply === "omit"
          ? []
          : [
              {
                idempotencyKey: record.idempotencyKey,
                kind: record.kind,
                status: "applied",
                ...reply,
              } as WireResult,
            ];
      });
    },
  };
}

export const rejected = (code: string, reason?: string, message = code): Partial<WireResult> => ({
  status: "rejected",
  reason: { code, message, data: reason ? { reason } : undefined },
});
