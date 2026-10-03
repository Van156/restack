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
export {
  connectivityReducer,
  initialConnectivity,
  isNetworkFailure,
  isOnline,
  type ConnectivityEvent,
  type ConnectivityState,
} from "./lib/connectivity";
export { withActor, type QueuedAction, type RecordActor } from "./lib/record-actor";
export { createLocalStorageAdapter } from "./lib/storage";
export { createSyncTransport } from "./lib/sync-transport";
export { QUEUE_KINDS } from "./lib/types";
export type {
  Clock,
  OfflineActor,
  OfflineIncident,
  QueueError,
  QueueKind,
  QueueRecord,
  QueueSnapshot,
  QueueStatus,
  QueueStorage,
  RecordSigner,
  SyncTransport,
  WireRecord,
  WireResult,
} from "./lib/types";
export {
  OfflineQueueProvider,
  SYNC_INTERVAL_MS,
  useOfflineQueue,
  type OfflineQueueApi,
} from "./components/offline-queue-provider";
