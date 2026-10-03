import type { OfflineStatus } from "@base-template/ui/lib/offline-banner-state";

import type { DeviceActivation } from "@/features/devices";

export type DeviceSession = { kind: "ready"; activation: DeviceActivation } | { kind: "activate" };

/** Ready with the stored activation, or the screen must be activated first. */
export function resolveDeviceSession(activation: DeviceActivation | null): DeviceSession {
  return activation ? { kind: "ready", activation } : { kind: "activate" };
}

/** The only credential a Paired device sends; it has no session cookie. */
export function deviceHeaders(token: string): Record<string, string> {
  return { authorization: `Device ${token}` };
}

/** The server answered that this token is unknown or revoked. */
export function isDeviceRejected(error: unknown): boolean {
  const code = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
  return code === "UNAUTHORIZED";
}

/**
 * Banner input for the kitchen: the outage since the first failed poll. The 24/40/48 h contingency
 * states never apply because orders and the kitchen are exempt from the 48 h block.
 */
export function offlineStatus(offlineSince: Date | null, now: Date): OfflineStatus {
  return {
    online: offlineSince === null,
    durationMs: offlineSince ? Math.max(0, now.getTime() - offlineSince.getTime()) : 0,
    alert: null,
    contingencyBlocked: false,
  };
}
