import type { Database } from "@base-template/db";

/** How the server reports one synced record. */
export const SYNC_STATUS = {
  applied: "applied",
  alreadyApplied: "already_applied",
  rejected: "rejected",
} as const;
export type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS];

/** Optional detail next to a status. */
export const SYNC_NOTE = {
  /** A last-write-wins write that lost to a newer one (nothing changed). */
  superseded: "superseded",
  /** The DIAN-off exempt receipt was returned instead of a document. */
  exemptReceipt: "exempt_receipt",
  /** An opened Table session joined the session already open at that Table. */
  merged: "merged",
} as const;
export type SyncNote = (typeof SYNC_NOTE)[keyof typeof SYNC_NOTE];

/** `applied` for a first write, `already_applied` when the write path found it done already. */
export function appliedOrReplayed(replayed: boolean): "applied" | "already_applied" {
  return replayed ? SYNC_STATUS.alreadyApplied : SYNC_STATUS.applied;
}

export type SyncOutcome = {
  status: Exclude<SyncStatus, "rejected">;
  /** Id of the row the record created or matched (line, void, payment, Table, session or document). */
  entityId?: string;
  note?: SyncNote;
};

/** Runs one record's writes in a transaction, so a rejection leaves nothing of that record behind. */
export function atomically<C extends { db: Database }, T>(
  context: C,
  work: (inner: C) => Promise<T>,
): Promise<T> {
  // The transaction handle serves every query the cores run; they only need `db`.
  return context.db.transaction((tx) => work({ ...context, db: tx as unknown as Database }));
}
