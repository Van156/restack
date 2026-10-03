import { ContingencyBlockedError } from "@/features/offline-queue";

import { describeCheckoutError } from "./checkout-errors";

type QueuedRecord = {
  kind: string;
  status: string;
  deviceRecordedAt: string;
  payload: Record<string, unknown>;
};

export type OfflineSale = {
  /** Payments of the session still waiting in the queue. */
  queuedPayments: number;
  /** The payment that closes the Bill is waiting, so the Bill settles on sync. */
  settleQueued: boolean;
  documentQueued: boolean;
  /** ISO time of the latest queued payment: the original sale time, or null. */
  saleTime: string | null;
};

const WAITING = new Set(["pending", "waiting", "failed"]);

/** What the offline queue holds for one session: queued payments, the closing flag and the document request. */
export function offlineSaleOf(records: readonly QueuedRecord[], sessionId: string): OfflineSale {
  const mine = records.filter(
    (record) => WAITING.has(record.status) && record.payload.tableSessionId === sessionId,
  );
  const payments = mine.filter((record) => record.kind === "payment" || record.kind === "takings");
  const times = payments.map((record) => record.deviceRecordedAt).toSorted();
  return {
    queuedPayments: payments.length,
    settleQueued: payments.some((record) => record.payload.settle === true),
    documentQueued: mine.some((record) => record.kind === "document_request"),
    saleTime: times.at(-1) ?? null,
  };
}

/** Why charging is blocked: after 48 hours offline only contingency sales stop. Null when nothing blocks it. */
export function paymentsBlockedReason(state: {
  online: boolean;
  contingencyBlocked: boolean;
}): string | null {
  return !state.online && state.contingencyBlocked
    ? describeCheckoutError(new ContingencyBlockedError())
    : null;
}
