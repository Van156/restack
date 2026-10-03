/** The offline window as the client queue reports it. */
export type OfflineStatus = {
  online: boolean;
  durationMs: number;
  alert: "warn_24h" | "warn_40h" | null;
  /** True from 48 h offline: contingency sales are blocked, orders and the kitchen continue. */
  contingencyBlocked: boolean;
};

export type OfflineBannerKind = "online" | "offline" | "warn_24h" | "warn_40h" | "blocked";

/** Which banner to show; the 48 h block outranks the 40 h and 24 h alerts. */
export function offlineBannerKind(status: OfflineStatus): OfflineBannerKind {
  if (status.online) {
    return "online";
  }
  if (status.contingencyBlocked) {
    return "blocked";
  }
  return status.alert ?? "offline";
}
