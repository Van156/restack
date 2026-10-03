import { Alert, AlertDescription, AlertTitle } from "@base-template/ui/components/alert";
import { Button } from "@base-template/ui/components/button";
import { useState } from "react";

import { client } from "@/app/orpc";
import { AuthCard } from "@/features/auth";

import {
  clearDeviceActivation,
  loadDeviceActivation,
  saveDeviceActivation,
  type DeviceActivation,
} from "../lib/device-activation-store";
import { normalizePairingCode } from "../lib/pairing-code";
import ActivationForm from "./activation-form";

/**
 * Public page where a kitchen screen redeems its pairing code. The device token is kept in this
 * browser's storage for the kitchen display; there is no session. See docs/architecture/restaurant.md.
 */
export default function DeviceActivationPage({ initialCode }: { initialCode?: string }) {
  const [code, setCode] = useState(() => normalizePairingCode(initialCode ?? ""));
  const [activation, setActivation] = useState<DeviceActivation | null>(() =>
    loadDeviceActivation(window.localStorage),
  );
  const [error, setError] = useState<string | null>(null);
  const [storageFailed, setStorageFailed] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function submit() {
    setError(null);
    setIsPending(true);
    try {
      const redeemed = await client.restaurant.devices.redeem({ code: normalizePairingCode(code) });
      setStorageFailed(!saveDeviceActivation(window.localStorage, redeemed));
      setActivation(redeemed);
      setCode("");
    } catch (redeemError) {
      setError(
        redeemError instanceof Error ? redeemError.message : "No pudimos activar la pantalla.",
      );
    } finally {
      setIsPending(false);
    }
  }

  if (activation) {
    return (
      <AuthCard
        title="Pantalla vinculada"
        description={`Esta pantalla quedó vinculada como «${activation.device.name}».`}
      >
        <div className="flex flex-col gap-4">
          {storageFailed ? (
            <Alert variant="destructive">
              <AlertTitle>No pudimos guardar la activación</AlertTitle>
              <AlertDescription>
                Este navegador no permite guardar datos, así que la pantalla se desvinculará al
                recargar. Usa otro navegador o desactiva la navegación privada.
              </AlertDescription>
            </Alert>
          ) : null}
          <Button
            size="lg"
            variant="outline"
            onClick={() => {
              clearDeviceActivation(window.localStorage);
              setActivation(null);
              setStorageFailed(false);
            }}
          >
            Vincular otra pantalla
          </Button>
        </div>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title="Activar pantalla de cocina"
      description="Escribe el código que ves en Dispositivos para vincular esta pantalla."
    >
      <ActivationForm
        code={code}
        error={error}
        isPending={isPending}
        onCodeChange={setCode}
        onSubmit={() => void submit()}
      />
    </AuthCard>
  );
}
