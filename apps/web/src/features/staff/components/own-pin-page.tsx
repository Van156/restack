import { Checkbox } from "@base-template/ui/components/checkbox";
import { useState } from "react";

import PageHeader from "@/shared/components/layout/page-header";

import { useStaffMutations } from "../hooks/use-staff-mutations";
import { advancePinEntry, startPinEntry, type PinEntryState } from "../lib/pin-entry";
import PinEntryFlow from "./pin-entry-flow";

/**
 * The caller's own PIN, for switching in on a shared device. Open to every member. There is no
 * way to ask whether a PIN exists, so the person says whether they are changing one.
 */
export default function OwnPinPage() {
  const { setOwnPin } = useStaffMutations();
  const [changing, setChanging] = useState(false);
  const [state, setState] = useState<PinEntryState>(() => startPinEntry(false));
  const [serverError, setServerError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  function restart(requireCurrent: boolean) {
    setChanging(requireCurrent);
    setState(startPinEntry(requireCurrent));
    setServerError(undefined);
    setSaved(false);
  }

  async function handlePin(pin: string) {
    setServerError(undefined);
    setSaved(false);
    const step = advancePinEntry(state, pin);
    setState(step.state);
    if (!step.submit) {
      return;
    }
    try {
      await setOwnPin.mutateAsync(step.submit);
      setSaved(true);
      setState(startPinEntry(changing));
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "No pudimos guardar el PIN.");
      setState(startPinEntry(changing));
    }
  }

  return (
    <div className="max-w-sm space-y-6">
      <PageHeader
        title="Mi PIN"
        description="Con tu PIN de 4 a 6 dígitos entras a un dispositivo compartido y tus ventas quedan a tu nombre."
      />
      <div className="flex items-center gap-2">
        <Checkbox
          id="own-pin-changing"
          checked={changing}
          onCheckedChange={(checked) => restart(checked)}
        />
        <label htmlFor="own-pin-changing" className="text-sm">
          Ya tengo un PIN y quiero cambiarlo
        </label>
      </div>
      {saved ? (
        <p role="status" className="text-sm text-muted-foreground">
          Tu PIN quedó guardado.
        </p>
      ) : null}
      <PinEntryFlow state={state} errorMessage={serverError} onPin={(pin) => void handlePin(pin)} />
      <p className="text-sm text-muted-foreground">
        ¿Olvidaste tu PIN? Pide a un administrador que lo restablezca.
      </p>
    </div>
  );
}
