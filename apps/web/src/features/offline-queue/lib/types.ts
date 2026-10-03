import type { SYNC_KINDS, SyncRecordResult } from "@base-template/api/routers/restaurant/sync";

/** Record kinds, exactly the server's sync contract (a type test keeps them equal). */
export const QUEUE_KINDS = [
  "open_session",
  "move_session",
  "order_line",
  "send_to_kitchen",
  "void",
  "payment",
  "table_metadata",
  "takings",
  "document_request",
] as const satisfies readonly (typeof SYNC_KINDS)[number][];
export type QueueKind = (typeof QUEUE_KINDS)[number];

/** Mirrors the server's `MAX_OFFLINE_TOKEN_AGE_MS`; older records are sent without a token or offline actor. */
export const TOKEN_MAX_AGE_MS = 48 * 60 * 60 * 1000;

/** Source of the current time, injected so tests and the offline window are deterministic. */
export type Clock = { now(): Date };

export type QueueStatus =
  /** Due now (or at `nextAttemptAt`). */
  | "pending"
  /** Held back until its dependency resolves: see `waitingOn`. */
  | "waiting"
  /** A transient failure; retried automatically once `nextAttemptAt` passes. */
  | "failed"
  /** Refused by the server for a business reason; kept for review, resent only by `retry`. */
  | "rejected"
  | "synced";

/** Attribution of a record made after an offline PIN switch-in; replaces the acting token. */
export type OfflineActor = { memberId: string; epoch: number; mac: string };

export type QueueError = {
  code: string;
  message: string;
  /** The server's `data.reason`, when it gave one. */
  reason?: string;
};

export type QueueRecord = {
  idempotencyKey: string;
  kind: QueueKind;
  payload: Record<string, unknown>;
  /** ISO time the device recorded the action (the sale time for a document request). */
  deviceRecordedAt: string;
  actingToken?: string;
  offlineActor?: OfflineActor;
  status: QueueStatus;
  waitingOn?: "session" | "override";
  /** Override attached after reconnect to a void that needed one. */
  overrideId?: string;
  attempts: number;
  lastError?: QueueError;
  /** ISO time the record is next due; null while held back or finished. */
  nextAttemptAt: string | null;
  result?: { entityId?: string; note?: string };
  syncedAt?: string;
};

export type OfflineIncident = { startedAt: string; endedAt: string | null };

export type QueueSnapshot = {
  version: 1;
  records: QueueRecord[];
  incidents: OfflineIncident[];
};

/** Durable home of the queue. Must reject when the write did not land. */
export interface QueueStorage {
  load(): Promise<QueueSnapshot | null>;
  save(snapshot: QueueSnapshot): Promise<void>;
}

/** What `sync.push` receives for one record. */
export type WireRecord = {
  idempotencyKey: string;
  kind: QueueKind;
  payload: Record<string, unknown>;
  deviceRecordedAt: string;
  actingToken?: string;
  offlineActor?: OfflineActor;
};

export type WireResult = SyncRecordResult;

/** `restaurant.sync.push`. Throws on a network or server failure; resolves with one result per record. */
export interface SyncTransport {
  push(records: WireRecord[]): Promise<WireResult[]>;
}
