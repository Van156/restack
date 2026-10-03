const HOUR_MS = 60 * 60 * 1000;

/** Product limits, not statute: see docs/architecture/restaurant.md#offline-queue. */
export const OFFLINE_WARN_FIRST_MS = 24 * HOUR_MS;
export const OFFLINE_WARN_SECOND_MS = 40 * HOUR_MS;
export const OFFLINE_BLOCK_MS = 48 * HOUR_MS;

export type OfflineAlert = "warn_24h" | "warn_40h" | null;

export type OfflineState = {
  online: boolean;
  offlineSince: string | null;
  durationMs: number;
  alert: OfflineAlert;
  /** True from 48 h offline: contingency sales stop, orders and kitchen carry on. */
  contingencyBlocked: boolean;
};

export function deriveOfflineState(offlineSince: string | null, now: Date): OfflineState {
  if (offlineSince === null) {
    return { online: true, offlineSince, durationMs: 0, alert: null, contingencyBlocked: false };
  }
  const durationMs = Math.max(0, now.getTime() - new Date(offlineSince).getTime());
  let alert: OfflineAlert = null;
  if (durationMs >= OFFLINE_WARN_SECOND_MS) {
    alert = "warn_40h";
  } else if (durationMs >= OFFLINE_WARN_FIRST_MS) {
    alert = "warn_24h";
  }
  return {
    online: false,
    offlineSince,
    durationMs,
    alert,
    contingencyBlocked: durationMs >= OFFLINE_BLOCK_MS,
  };
}
