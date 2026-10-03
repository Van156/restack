import {
  holdForOverride,
  holdForSession,
  markRecordSynced,
  reject,
  scheduleRetry,
} from "./transitions";
import { TOKEN_MAX_AGE_MS } from "./types";
import type { QueueError, QueueRecord, WireRecord, WireResult } from "./types";

/** Server limit for one `sync.push`. */
export const MAX_BATCH = 200;

export const SESSION_NOT_SYNCED = "session_not_synced";
export const OVERRIDE_REQUIRED = "override_required";
export const OVERRIDE_INVALID = "override_invalid";

/** Codes that clear by themselves (server hiccup, throttling, a session to renew): retried with backoff. */
const TRANSIENT_CODES = new Set([
  "INTERNAL_SERVER_ERROR",
  "SERVICE_UNAVAILABLE",
  "BAD_GATEWAY",
  "GATEWAY_TIMEOUT",
  "TIMEOUT",
  "TOO_MANY_REQUESTS",
  "UNAUTHORIZED",
]);

/** The record this one needs the server to know first: its Table session opener or its line. */
function dependencyKey(record: QueueRecord): string | undefined {
  const { sessionKey, lineKey } = record.payload;
  const key = record.kind === "void" ? lineKey : sessionKey;
  return typeof key === "string" ? key : undefined;
}

/**
 * The session a record names, as a server id when it can be known: a session opened by this queue
 * and already synced is the same session whether it is named by key or by id.
 */
function sessionIdentity(
  record: QueueRecord,
  byKey: ReadonlyMap<string, QueueRecord>,
): string | undefined {
  const { tableSessionId, sessionKey } = record.payload;
  if (typeof tableSessionId === "string") {
    return tableSessionId;
  }
  if (typeof sessionKey !== "string") {
    return undefined;
  }
  return byKey.get(sessionKey)?.result?.entityId ?? sessionKey;
}

/** A line or removal that has to reach the server before a send, or the Ticket would miss it. */
function isLineWork(record: QueueRecord): boolean {
  const unapplied =
    record.status === "pending" || record.status === "failed" || record.status === "waiting";
  return (
    unapplied &&
    (record.kind === "order_line" || (record.kind === "void" && record.waitingOn !== "override"))
  );
}

/** Whether the record's own status lets it go out now, before looking at dependencies. */
function isDue(record: QueueRecord, now: number, opener: QueueRecord | undefined): boolean {
  const dueAt = record.nextAttemptAt === null ? Infinity : new Date(record.nextAttemptAt).getTime();
  switch (record.status) {
    case "pending":
    case "failed":
      return dueAt <= now;
    case "waiting":
      if (record.waitingOn === "override") {
        return false;
      }
      // Waiting for a session: resend as soon as its opener is known, else after the backoff.
      return opener ? opener.status === "synced" : dueAt <= now;
    default:
      return false;
  }
}

/**
 * Due records in queue order, up to `max`. A record that names an unsent opener or line goes only
 * after it in the same batch; one whose opener was rejected is held back. `skip` keys were
 * already tried in this run.
 */
export function selectDue(
  records: QueueRecord[],
  now: Date,
  max = MAX_BATCH,
  skip: ReadonlySet<string> = new Set(),
): QueueRecord[] {
  const byKey = new Map(records.map((r) => [r.idempotencyKey, r]));
  const chosen = new Set<string>();
  const batch: QueueRecord[] = [];
  const holdsSend = (send: QueueRecord, index: number) => {
    const session = sessionIdentity(send, byKey);
    return records
      .slice(0, index)
      .some(
        (earlier) =>
          isLineWork(earlier) &&
          !chosen.has(earlier.idempotencyKey) &&
          sessionIdentity(earlier, byKey) === session,
      );
  };
  for (const [index, record] of records.entries()) {
    if (batch.length >= max) {
      break;
    }
    if (skip.has(record.idempotencyKey)) {
      continue;
    }
    const needs = dependencyKey(record);
    const dependency = needs ? byKey.get(needs) : undefined;
    if (!isDue(record, now.getTime(), dependency)) {
      continue;
    }
    if (dependency && dependency.status !== "synced" && !chosen.has(dependency.idempotencyKey)) {
      continue;
    }
    if (record.kind === "send_to_kitchen" && holdsSend(record, index)) {
      continue;
    }
    chosen.add(record.idempotencyKey);
    batch.push(record);
  }
  return batch;
}

/**
 * What `sync.push` receives: the Override attached since, and no token or offline actor older than
 * the server accepts.
 */
export function toWire(record: QueueRecord, now: Date): WireRecord {
  const payload = record.overrideId
    ? { ...record.payload, overrideId: record.overrideId }
    : record.payload;
  const tokenAge = now.getTime() - new Date(record.deviceRecordedAt).getTime();
  const withinWindow = tokenAge <= TOKEN_MAX_AGE_MS;
  const keepToken = record.actingToken !== undefined && withinWindow;
  const keepActor = record.offlineActor !== undefined && withinWindow;
  return {
    idempotencyKey: record.idempotencyKey,
    kind: record.kind,
    payload: structuredClone(payload),
    deviceRecordedAt: record.deviceRecordedAt,
    ...(keepToken ? { actingToken: record.actingToken } : {}),
    ...(keepActor ? { offlineActor: record.offlineActor } : {}),
  };
}

export type SyncOutcome = "synced" | "failed" | "waiting" | "rejected";

/** Applies the server's answer for one record (or its absence) to the stored record. */
export function applyResult(
  record: QueueRecord,
  result: WireResult | undefined,
  now: Date,
): SyncOutcome {
  if (!result) {
    scheduleRetry(record, { code: "NO_RESULT", message: "The server sent no result." }, now);
    return "failed";
  }
  if (result.status !== "rejected") {
    const { entityId, note } = result;
    markRecordSynced(record, now, { ...(entityId ? { entityId } : {}), ...(note ? { note } : {}) });
    return "synced";
  }

  const code = result.reason?.code ?? "REJECTED";
  const data = result.reason?.data as { reason?: unknown } | undefined;
  const reason = typeof data?.reason === "string" ? data.reason : undefined;
  const error: QueueError = {
    code,
    message: result.reason?.message ?? code,
    ...(reason ? { reason } : {}),
  };

  if (reason === OVERRIDE_REQUIRED || reason === OVERRIDE_INVALID) {
    holdForOverride(record, error);
    // A spent or unusable Override cannot be reused: the void needs a fresh one.
    delete record.overrideId;
    return "waiting";
  }
  if (reason === SESSION_NOT_SYNCED) {
    holdForSession(record, error, now);
    return "waiting";
  }
  if (TRANSIENT_CODES.has(code)) {
    scheduleRetry(record, error, now);
    return "failed";
  }
  reject(record, error);
  return "rejected";
}

export function failBatch(records: QueueRecord[], error: QueueError, now: Date): void {
  for (const record of records) {
    scheduleRetry(record, error, now);
  }
}
