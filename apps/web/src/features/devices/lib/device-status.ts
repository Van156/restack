export type DeviceStatus = "pending" | "active" | "revoked";

export type DeviceStatusView = { label: string; tone: "ok" | "pending" | "warning" | "off" };

/** How a Paired device shows in the list; a pending one depends on whether its code is still valid. */
export function deviceStatusView(
  device: { status: DeviceStatus; activationExpiresAt: Date | null },
  now: Date,
): DeviceStatusView {
  switch (device.status) {
    case "active":
      return { label: "Activa", tone: "ok" };
    case "revoked":
      return { label: "Revocada", tone: "off" };
    case "pending":
      return device.activationExpiresAt && device.activationExpiresAt > now
        ? { label: "Esperando el código", tone: "pending" }
        : { label: "Código vencido", tone: "warning" };
  }
}
