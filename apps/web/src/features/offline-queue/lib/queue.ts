import { backoffDelayMs } from "./backoff";
import { deriveOfflineState } from "./offline-window";
import type { OfflineState } from "./offline-window";
import { QUEUE_KINDS } from "./types";
import type {
  Clock,
  OfflineIncident,
  QueueError,
  QueueKind,
  QueueRecord,
  QueueSnapshot,
  QueueStorage,
} from "./types";

export class InvalidRecordError extends Error {}

/** A contingency sale was queued after 48 h offline. */
export class ContingencyBlockedError extends Error {
  constructor() {
    super("Contingency sales are blocked after 48 hours offline.");
  }
}

export type EnqueueInput = {
  kind: QueueKind;
  payload: Record<string, unknown>;
  /** Defaults to a generated key. For `open_session` this is the session key. */
  idempotencyKey?: string;
  /** Defaults to the clock's now; a document request passes the original sale time. */
  deviceRecordedAt?: Date | string;
  actingToken?: string;
};

export type OfflineQueueDeps = {
  storage: QueueStorage;
  clock: Clock;
  /** Idempotency key generator; defaults to `crypto.randomUUID`. */
  newKey?: () => string;
};

type State = { records: QueueRecord[]; incidents: OfflineIncident[] };

/** Kinds that count as contingency sales; a document request opts out with `contingency: false`. */
function isContingencySale(kind: QueueKind, payload: Record<string, unknown>): boolean {
  if (kind === "payment" || kind === "takings") {
    return true;
  }
  return kind === "document_request" && payload.contingency !== false;
}

function prepare(kind: QueueKind, payload: Record<string, unknown>): Record<string, unknown> {
  if (!QUEUE_KINDS.includes(kind)) {
    throw new InvalidRecordError(`Unknown record kind "${String(kind)}".`);
  }
  const next = structuredClone(payload);
  if (kind === "order_line") {
    const price = next.unitPrice;
    if (typeof price !== "number" || !Number.isInteger(price) || price < 0) {
      throw new InvalidRecordError("An order line needs the integer Menu price it was taken at.");
    }
  }
  if (kind === "payment" || kind === "takings") {
    if (next.tender !== "cash" && !next.reference) {
      throw new InvalidRecordError("Card and QR/transfer payments need a reference.");
    }
    next.registeredOffline = true;
  }
  if (kind === "document_request" && next.contingency === undefined) {
    next.contingency = true;
  }
  return next;
}

export async function openOfflineQueue(deps: OfflineQueueDeps) {
  const { storage, clock } = deps;
  const newKey = deps.newKey ?? (() => crypto.randomUUID());
  const loaded = await storage.load();
  let state: State = loaded
    ? { records: loaded.records, incidents: loaded.incidents }
    : { records: [], incidents: [] };
  let lock: Promise<unknown> = Promise.resolve();

  const toSnapshot = (draft: State): QueueSnapshot => ({ version: 1, ...draft });
  const iso = (date: Date) => date.toISOString();
  const offlineSince = (draft: State = state) =>
    draft.incidents.find((i) => i.endedAt === null)?.startedAt ?? null;

  /** Applies `change` to a copy and commits it only once the storage write landed. */
  function mutate<T>(change: (draft: State) => T): Promise<T> {
    const run = lock
      .catch(() => {})
      .then(async () => {
        const draft = structuredClone(state);
        const out = change(draft);
        await storage.save(toSnapshot(draft));
        state = draft;
        return out;
      });
    lock = run;
    return run;
  }

  function find(draft: State, key: string): QueueRecord {
    const record = draft.records.find((r) => r.idempotencyKey === key);
    if (!record) {
      throw new Error(`No queued record with key "${key}".`);
    }
    return record;
  }

  return {
    /** Appends a record; a key already queued returns the stored record untouched. */
    async enqueue(input: EnqueueInput): Promise<QueueRecord> {
      const payload = prepare(input.kind, input.payload);
      const now = clock.now();
      if (
        isContingencySale(input.kind, payload) &&
        deriveOfflineState(offlineSince(), now).contingencyBlocked
      ) {
        throw new ContingencyBlockedError();
      }
      const key = input.idempotencyKey ?? newKey();
      const recordedAt = input.deviceRecordedAt ? new Date(input.deviceRecordedAt) : now;
      return mutate((draft) => {
        const existing = draft.records.find((r) => r.idempotencyKey === key);
        if (existing) {
          return structuredClone(existing);
        }
        const record: QueueRecord = {
          idempotencyKey: key,
          kind: input.kind,
          payload,
          deviceRecordedAt: iso(recordedAt),
          ...(input.actingToken ? { actingToken: input.actingToken } : {}),
          status: "pending",
          attempts: 0,
          nextAttemptAt: iso(now),
        };
        draft.records.push(record);
        return structuredClone(record);
      });
    },

    list(): QueueRecord[] {
      return structuredClone(state.records);
    },

    get(key: string): QueueRecord | undefined {
      const record = state.records.find((r) => r.idempotencyKey === key);
      return record ? structuredClone(record) : undefined;
    },

    markSynced(key: string, result?: QueueRecord["result"]): Promise<void> {
      const now = iso(clock.now());
      return mutate((draft) => {
        const record = find(draft, key);
        record.status = "synced";
        record.nextAttemptAt = null;
        record.syncedAt = now;
        delete record.waitingOn;
        delete record.lastError;
        if (result) {
          record.result = result;
        }
      });
    },

    /** Keeps the record and schedules its next attempt with backoff. */
    markFailed(key: string, error: QueueError): Promise<void> {
      const now = clock.now();
      return mutate((draft) => {
        const record = find(draft, key);
        if (record.status === "synced") {
          throw new Error(`Record "${key}" is already synced.`);
        }
        record.attempts += 1;
        record.status = "failed";
        record.lastError = error;
        delete record.waitingOn;
        record.nextAttemptAt = iso(new Date(now.getTime() + backoffDelayMs(record.attempts)));
      });
    },

    /** Makes a failed, waiting or rejected record due now. */
    retry(key: string): Promise<void> {
      const now = iso(clock.now());
      return mutate((draft) => {
        const record = find(draft, key);
        if (record.status === "synced") {
          throw new Error(`Record "${key}" is already synced.`);
        }
        record.status = "pending";
        delete record.waitingOn;
        record.nextAttemptAt = now;
      });
    },

    /** Drops synced records; unsynced ones are never dropped. */
    purgeSynced(): Promise<number> {
      return mutate((draft) => {
        const before = draft.records.length;
        draft.records = draft.records.filter((r) => r.status !== "synced");
        return before - draft.records.length;
      });
    },

    reportOffline(): Promise<void> {
      const now = iso(clock.now());
      return mutate((draft) => {
        if (offlineSince(draft) === null) {
          draft.incidents.push({ startedAt: now, endedAt: null });
        }
      });
    },

    reportOnline(): Promise<void> {
      const now = iso(clock.now());
      return mutate((draft) => {
        const open = draft.incidents.find((i) => i.endedAt === null);
        if (open) {
          open.endedAt = now;
        }
      });
    },

    offlineState(): OfflineState {
      return deriveOfflineState(offlineSince(), clock.now());
    },

    incidents(): OfflineIncident[] {
      return structuredClone(state.incidents);
    },
  };
}

export type OfflineQueue = Awaited<ReturnType<typeof openOfflineQueue>>;
