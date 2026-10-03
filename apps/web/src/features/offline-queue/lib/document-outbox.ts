import type { QueueError, QueueRecord } from "./types";

export type DocumentOutboxEntry = {
  idempotencyKey: string;
  /** The original sale time. */
  saleTime: string;
  contingency: boolean;
  status: QueueRecord["status"];
  attempts: number;
  lastError?: QueueError;
  nextAttemptAt: string | null;
};

/** Document requests not yet transmitted, oldest first. */
export function documentOutbox(records: readonly QueueRecord[]): DocumentOutboxEntry[] {
  return records
    .filter((r) => r.kind === "document_request" && r.status !== "synced")
    .map((r) => ({
      idempotencyKey: r.idempotencyKey,
      saleTime: r.deviceRecordedAt,
      contingency: r.payload.contingency !== false,
      status: r.status,
      attempts: r.attempts,
      ...(r.lastError ? { lastError: structuredClone(r.lastError) } : {}),
      nextAttemptAt: r.nextAttemptAt,
    }));
}
