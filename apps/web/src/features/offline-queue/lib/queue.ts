import { MAX_BATCH, applyResult, failBatch, selectDue, toWire } from "./batch";
import type { SyncOutcome } from "./batch";
import { documentOutbox } from "./document-outbox";
import type { DocumentOutboxEntry } from "./document-outbox";
import { deriveOfflineState } from "./offline-window";
import type { OfflineState } from "./offline-window";
import { makeDue, markRecordSynced, scheduleRetry } from "./transitions";
import { QUEUE_KINDS } from "./types";
import type {
  Clock,
  OfflineActor,
  OfflineIncident,
  QueueError,
  QueueKind,
  QueueRecord,
  QueueSnapshot,
  QueueStorage,
  SyncTransport,
  WireRecord,
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
  /** From an offline PIN switch-in, signed for exactly this key, kind and `deviceRecordedAt`. */
  offlineActor?: OfflineActor;
};

export type OfflineQueueDeps = {
  storage: QueueStorage;
  clock: Clock;
  transport: SyncTransport;
  /** Idempotency key generator; defaults to `crypto.randomUUID`. */
  newKey?: () => string;
};

export type SyncReport = { sent: number } & Record<SyncOutcome, number>;

export type { DocumentOutboxEntry };

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
  const { storage, clock, transport } = deps;
  const newKey = deps.newKey ?? (() => crypto.randomUUID());
  const loaded = await storage.load();
  let state: State = loaded
    ? { records: loaded.records, incidents: loaded.incidents }
    : { records: [], incidents: [] };
  let lock: Promise<unknown> = Promise.resolve();
  let inFlight: Promise<SyncReport> | null = null;

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

  /** The record, which must not be synced yet: a synced record never moves again. */
  function findUnsynced(draft: State, key: string): QueueRecord {
    const record = find(draft, key);
    if (record.status === "synced") {
      throw new Error(`Record "${key}" is already synced.`);
    }
    return record;
  }

  return {
    /** Idempotent: a key already queued returns the stored record. */
    async enqueue(input: EnqueueInput): Promise<QueueRecord> {
      if (input.actingToken && input.offlineActor) {
        throw new InvalidRecordError("A record has an acting token or an offline actor, not both.");
      }
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
          ...(input.offlineActor ? { offlineActor: input.offlineActor } : {}),
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
      const now = clock.now();
      return mutate((draft) => markRecordSynced(find(draft, key), now, result));
    },

    markFailed(key: string, error: QueueError): Promise<void> {
      const now = clock.now();
      return mutate((draft) => scheduleRetry(findUnsynced(draft, key), error, now));
    },

    retry(key: string): Promise<void> {
      const now = clock.now();
      return mutate((draft) => makeDue(findUnsynced(draft, key), now));
    },

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

    selectBatch(): WireRecord[] {
      const now = clock.now();
      return selectDue(state.records, now, MAX_BATCH).map((record) => toWire(record, now));
    },

    /** Pushes every due record in batches of at most 200 and files each result. Overlapping calls share one run. */
    sync(): Promise<SyncReport> {
      inFlight ??= (async () => {
        const report: SyncReport = { sent: 0, synced: 0, failed: 0, waiting: 0, rejected: 0 };
        const tried = new Set<string>();
        for (;;) {
          const now = clock.now();
          const due = selectDue(state.records, now, MAX_BATCH, tried);
          if (due.length === 0) {
            return report;
          }
          const wire = due.map((record) => toWire(record, now));
          const keys = due.map((record) => record.idempotencyKey);
          for (const key of keys) {
            tried.add(key);
          }
          let results: Awaited<ReturnType<SyncTransport["push"]>> | null = null;
          let failure: string | null = null;
          try {
            results = await transport.push(wire);
          } catch (error) {
            failure = error instanceof Error ? error.message : String(error);
          }
          const settledAt = clock.now();
          await mutate((draft) => {
            const sent = keys.map((key) => find(draft, key));
            if (results === null) {
              failBatch(sent, { code: "NETWORK", message: failure ?? "Push failed." }, settledAt);
              report.failed += sent.length;
              return;
            }
            const byKey = new Map(results.map((result) => [result.idempotencyKey, result]));
            for (const record of sent) {
              report[applyResult(record, byKey.get(record.idempotencyKey), settledAt)] += 1;
            }
          });
          report.sent += keys.length;
        }
      })().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },

    /** Gives a void that needs an Override the one obtained after reconnect, and makes it due. */
    attachOverride(key: string, overrideId: string): Promise<void> {
      const now = clock.now();
      return mutate((draft) => {
        const record = find(draft, key);
        if (record.kind !== "void" || record.status === "synced") {
          throw new Error(`Record "${key}" cannot take an Override.`);
        }
        record.overrideId = overrideId;
        makeDue(record, now);
      });
    },

    documentOutbox(): DocumentOutboxEntry[] {
      return documentOutbox(state.records);
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
