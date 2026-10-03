import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@base-template/ui/components/dialog";
import { useState } from "react";

import { useStaffMutations } from "../hooks/use-staff-mutations";
import { advancePinEntry, startPinEntry, type PinEntryState } from "../lib/pin-entry";
import PinEntryFlow from "./pin-entry-flow";

/** Administrator flow to set a new PIN for a Staff member who forgot theirs; typed twice. */
export default function ResetPinDialog({
  memberId,
  memberLabel,
  onClose,
}: {
  memberId: string;
  memberLabel: string;
  onClose: () => void;
}) {
  const { resetPin } = useStaffMutations();
  const [state, setState] = useState<PinEntryState>(() => startPinEntry(false));
  const [serverError, setServerError] = useState<string | undefined>();

  async function handlePin(pin: string) {
    setServerError(undefined);
    const step = advancePinEntry(state, pin);
    setState(step.state);
    if (!step.submit) {
      return;
    }
    try {
      await resetPin.mutateAsync({ memberId, pin: step.submit.pin });
      onClose();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "No pudimos restablecer el PIN.");
      setState(startPinEntry(false));
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restablecer el PIN de {memberLabel}</DialogTitle>
          <DialogDescription>
            El nuevo PIN reemplaza al anterior y quita cualquier bloqueo.
          </DialogDescription>
        </DialogHeader>
        <PinEntryFlow
          state={state}
          errorMessage={serverError}
          onPin={(pin) => void handlePin(pin)}
        />
      </DialogContent>
    </Dialog>
  );
}
