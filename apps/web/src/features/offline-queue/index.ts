/** Public API of the offline-queue feature: a pure queue with injected storage, clock and transport. */
export { backoffDelayMs } from "./lib/backoff";
export { ContingencyBlockedError, InvalidRecordError, openOfflineQueue } from "./lib/queue";
export type {
  DocumentOutboxEntry,
  EnqueueInput,
  OfflineQueue,
  OfflineQueueDeps,
  SyncReport,
} from "./lib/queue";
export type { OfflineAlert, OfflineState } from "./lib/offline-window";
export { createLocalStorageAdapter } from "./lib/storage";
export { QUEUE_KINDS } from "./lib/types";
export type {
  Clock,
  OfflineIncident,
  QueueError,
  QueueKind,
  QueueRecord,
  QueueSnapshot,
  QueueStatus,
  QueueStorage,
  SyncTransport,
  WireRecord,
  WireResult,
} from "./lib/types";
