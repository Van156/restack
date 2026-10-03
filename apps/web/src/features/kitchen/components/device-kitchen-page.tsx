import { Button } from "@base-template/ui/components/button";
import { Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";

import { clearDeviceActivation, loadDeviceActivation } from "@/features/devices";
import EmptyState from "@/shared/components/feedback/empty-state";

import { useDeviceKitchenSource } from "../hooks/use-kitchen-sources";
import { resolveDeviceSession } from "../lib/device-session";
import KitchenBoard from "./kitchen-board";

/**
 * Kitchen display of a Paired device, with no user session. A screen that was never activated goes
 * to `/activate`; one the server no longer accepts (revoked) forgets its token and says so.
 */
export default function DeviceKitchenPage() {
  const [session] = useState(() => resolveDeviceSession(loadDeviceActivation(window.localStorage)));
  const [revoked, setRevoked] = useState(false);

  if (revoked) {
    return (
      <main className="mx-auto max-w-lg p-8">
        <EmptyState
          title="Esta pantalla fue desvinculada"
          description="Un administrador la desvinculó o el código ya no es válido. Actívala de nuevo con un código nuevo."
          action={
            <Button size="lg" nativeButton={false} render={<Link to="/activate" />}>
              Activar pantalla
            </Button>
          }
        />
      </main>
    );
  }
  if (session.kind === "activate") {
    return <Navigate to="/activate" replace />;
  }
  return (
    <ActivatedKitchen
      deviceToken={session.activation.deviceToken}
      deviceName={session.activation.device.name}
      onRejected={() => {
        clearDeviceActivation(window.localStorage);
        setRevoked(true);
      }}
    />
  );
}

function ActivatedKitchen({
  deviceToken,
  deviceName,
  onRejected,
}: {
  deviceToken: string;
  deviceName: string;
  onRejected: () => void;
}) {
  const source = useDeviceKitchenSource(deviceToken);
  return (
    <main className="min-h-screen space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Cocina · {deviceName}</h1>
      <KitchenBoard source={source} onRejected={onRejected} />
    </main>
  );
}
