/** What the activated screen keeps: the secret token (shown once by the server) and its identity. */
export type DeviceActivation = {
  deviceToken: string;
  device: { id: string; name: string; locationId: string; stationIds: string[] };
};

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Storage key the kitchen display reads to authenticate as this Paired device. */
export const DEVICE_ACTIVATION_KEY = "restack.device-activation";

function isActivation(value: unknown): value is DeviceActivation {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { deviceToken, device } = value as Partial<DeviceActivation>;
  return (
    typeof deviceToken === "string" &&
    deviceToken !== "" &&
    typeof device === "object" &&
    device !== null &&
    typeof device.id === "string" &&
    typeof device.name === "string" &&
    typeof device.locationId === "string" &&
    Array.isArray(device.stationIds)
  );
}

/** The stored activation, or `null` when absent, corrupt or storage is unavailable. */
export function loadDeviceActivation(storage: KeyValueStorage): DeviceActivation | null {
  try {
    const raw = storage.getItem(DEVICE_ACTIVATION_KEY);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isActivation(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Returns whether the activation was stored; `false` means the token would be lost on reload. */
export function saveDeviceActivation(
  storage: KeyValueStorage,
  activation: DeviceActivation,
): boolean {
  try {
    storage.setItem(DEVICE_ACTIVATION_KEY, JSON.stringify(activation));
    return true;
  } catch {
    return false;
  }
}

export function clearDeviceActivation(storage: KeyValueStorage): void {
  try {
    storage.removeItem(DEVICE_ACTIVATION_KEY);
  } catch {
    // Nothing stored that we could reach; the next load reads as empty anyway.
  }
}
