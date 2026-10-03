import { backoffDelayMs } from "./backoff";
import type { QueueError, QueueRecord } from "./types";

/** ISO time of the retry that follows the `attempts`th failed attempt. */
export function nextAttemptIso(now: Date, attempts: number): string {
  return new Date(now.getTime() + backoffDelayMs(attempts)).toISOString();
}

type Attempt = {
  status: "failed" | "waiting" | "rejected";
  error: QueueError;
  nextAttemptAt: string | null;
  waitingOn?: "session" | "override";
};

/** Counts one more attempt and files why it did not finish. */
function recordAttempt(record: QueueRecord, to: Attempt): void {
  record.attempts += 1;
  record.status = to.status;
  record.lastError = to.error;
  record.nextAttemptAt = to.nextAttemptAt;
  if (to.waitingOn) {
    record.waitingOn = to.waitingOn;
  } else {
    delete record.waitingOn;
  }
}

/** A transient failure: keeps the record and schedules the next attempt with backoff. */
export function scheduleRetry(record: QueueRecord, error: QueueError, now: Date): void {
  const attempts = record.attempts + 1;
  recordAttempt(record, { status: "failed", error, nextAttemptAt: nextAttemptIso(now, attempts) });
}

/** Held until an Override is attached; never retried by the clock. */
export function holdForOverride(record: QueueRecord, error: QueueError): void {
  recordAttempt(record, { status: "waiting", error, nextAttemptAt: null, waitingOn: "override" });
}

/** Held until the Table session opener is synced, or the backoff passes. */
export function holdForSession(record: QueueRecord, error: QueueError, now: Date): void {
  const attempts = record.attempts + 1;
  recordAttempt(record, {
    status: "waiting",
    error,
    nextAttemptAt: nextAttemptIso(now, attempts),
    waitingOn: "session",
  });
}

/** Refused for a business reason: kept for review, resent only by an explicit retry. */
export function reject(record: QueueRecord, error: QueueError): void {
  recordAttempt(record, { status: "rejected", error, nextAttemptAt: null });
}

/** Makes the record due now. */
export function makeDue(record: QueueRecord, now: Date): void {
  record.status = "pending";
  delete record.waitingOn;
  record.nextAttemptAt = now.toISOString();
}

/** Marks a record synced and clears its retry and waiting state. */
export function markRecordSynced(
  record: QueueRecord,
  now: Date,
  result?: QueueRecord["result"],
): void {
  record.status = "synced";
  record.nextAttemptAt = null;
  record.syncedAt = now.toISOString();
  delete record.waitingOn;
  delete record.lastError;
  if (result) {
    record.result = result;
  }
}
