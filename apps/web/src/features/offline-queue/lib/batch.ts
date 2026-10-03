import { backoffDelayMs } from "./backoff";
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
  for (const record of records) {
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
    chosen.add(record.idempotencyKey);
    batch.push(record);
  }
  return batch;
}

/** What `sync.push` receives: the Override attached since, and no token older than the server accepts. */
export function toWire(record: QueueRecord, now: Date): WireRecord {
  const payload = record.overrideId
    ? { ...record.payload, overrideId: record.overrideId }
    : record.payload;
  const tokenAge = now.getTime() - new Date(record.deviceRecordedAt).getTime();
  const keepToken = record.actingToken !== undefined && tokenAge <= TOKEN_MAX_AGE_MS;
  return {
    idempotencyKey: record.idempotencyKey,
    kind: record.kind,
    payload: structuredClone(payload),
    deviceRecordedAt: record.deviceRecordedAt,
    ...(keepToken ? { actingToken: record.actingToken } : {}),
  };
}

export type SyncOutcome = "synced" | "failed" | "waiting" | "rejected";

function fail(record: QueueRecord, error: QueueError, now: Date): "failed" {
  record.attempts += 1;
  record.status = "failed";
  record.lastError = error;
  record.nextAttemptAt = new Date(now.getTime() + backoffDelayMs(record.attempts)).toISOString();
  return "failed";
}

/** Applies the server's answer for one record (or its absence) to the stored record. */
export function applyResult(
  record: QueueRecord,
  result: WireResult | undefined,
  now: Date,
): SyncOutcome {
  if (!result) {
    return fail(record, { code: "NO_RESULT", message: "The server sent no result." }, now);
  }
  if (result.status !== "rejected") {
    record.status = "synced";
    record.nextAttemptAt = null;
    record.syncedAt = now.toISOString();
    delete record.waitingOn;
    delete record.lastError;
    const { entityId, note } = result;
    record.result = { ...(entityId ? { entityId } : {}), ...(note ? { note } : {}) };
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
    record.attempts += 1;
    record.status = "waiting";
    record.waitingOn = "override";
    record.lastError = error;
    record.nextAttemptAt = null;
    // A rejected Override is spent or unusable: the void waits for a fresh one.
    delete record.overrideId;
    return "waiting";
  }
  if (reason === SESSION_NOT_SYNCED) {
    record.attempts += 1;
    record.status = "waiting";
    record.waitingOn = "session";
    record.lastError = error;
    record.nextAttemptAt = new Date(now.getTime() + backoffDelayMs(record.attempts)).toISOString();
    return "waiting";
  }
  if (TRANSIENT_CODES.has(code)) {
    return fail(record, error, now);
  }
  record.attempts += 1;
  record.status = "rejected";
  record.lastError = error;
  record.nextAttemptAt = null;
  delete record.waitingOn;
  return "rejected";
}

export function failBatch(records: QueueRecord[], error: QueueError, now: Date): void {
  for (const record of records) {
    fail(record, error, now);
  }
}
