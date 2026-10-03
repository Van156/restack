import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import { useState } from "react";

import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";

import { deviceStatusView, type DeviceStatus } from "../lib/device-status";
import { formatBogotaDateTime, formatBogotaTime } from "../lib/format-time";

export type DeviceRow = {
  id: string;
  name: string;
  status: DeviceStatus;
  lastSeenAt: Date | null;
  activationExpiresAt: Date | null;
  stationNames: string[];
};

const TONE_VARIANT = {
  ok: "default",
  pending: "secondary",
  warning: "destructive",
  off: "outline",
} as const;

/** Paired devices with status, Stations, rename and revoke. `now` decides whether a code expired. */
export default function DeviceList({
  devices,
  now,
  isBusy,
  onRename,
  onRevoke,
}: {
  devices: readonly DeviceRow[];
  now: Date;
  isBusy: boolean;
  onRename: (id: string, name: string) => Promise<unknown>;
  onRevoke: (id: string) => Promise<unknown>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [toRevoke, setToRevoke] = useState<DeviceRow | null>(null);

  async function saveRename(id: string) {
    try {
      await onRename(id, name.trim());
      setEditingId(null);
    } catch {
      // Reported by the mutation; the row stays in edit mode.
    }
  }

  if (devices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay pantallas emparejadas en este local.
      </p>
    );
  }
  return (
    <>
      <ul aria-label="Pantallas emparejadas" className="divide-y rounded-md border">
        {devices.map((device) => {
          const status = deviceStatusView(device, now);
          return (
            <li key={device.id} className="flex flex-wrap items-center gap-3 p-3">
              {editingId === device.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (name.trim()) {
                      void saveRename(device.id);
                    }
                  }}
                >
                  <Input
                    aria-label={`Nuevo nombre de ${device.name}`}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <Button type="submit" size="sm" disabled={isBusy || name.trim() === ""}>
                    Guardar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(null)}
                  >
                    Cancelar
                  </Button>
                </form>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{device.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {device.stationNames.length > 0
                        ? `Estaciones: ${device.stationNames.join(", ")}`
                        : "Sin estaciones"}
                      {device.status === "pending" &&
                      device.activationExpiresAt &&
                      device.activationExpiresAt > now
                        ? ` · El código vence a las ${formatBogotaTime(device.activationExpiresAt)}`
                        : ""}
                      {device.lastSeenAt
                        ? ` · Visto ${formatBogotaDateTime(device.lastSeenAt)}`
                        : ""}
                    </p>
                  </div>
                  <Badge variant={TONE_VARIANT[status.tone]}>{status.label}</Badge>
                  {device.status === "revoked" ? null : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(device.id);
                          setName(device.name);
                        }}
                      >
                        Renombrar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setToRevoke(device)}>
                        Revocar
                      </Button>
                    </>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={toRevoke !== null}
        onOpenChange={(open) => {
          if (!open) {
            setToRevoke(null);
          }
        }}
        title={toRevoke ? `Revocar ${toRevoke.name}` : "Revocar"}
        description="La pantalla deja de funcionar de inmediato y un código sin usar deja de servir. Para volver a usarla tendrás que emparejarla otra vez."
        confirmLabel="Revocar"
        cancelLabel="Cancelar"
        onConfirm={async () => {
          if (toRevoke) {
            await onRevoke(toRevoke.id);
          }
        }}
      />
    </>
  );
}
