import { PinPad } from "@base-template/ui/components/pin-pad";

import { pinEntryTitle, type PinEntryState } from "../lib/pin-entry";

/** One stage of PIN entry with the T13 `PinPad`; the container advances the stage. */
export default function PinEntryFlow({
  state,
  errorMessage,
  onPin,
}: {
  state: PinEntryState;
  /** Server failure to show on the pad; takes precedence over the flow's own message. */
  errorMessage?: string;
  onPin: (pin: string) => void;
}) {
  const message = errorMessage ?? state.message;
  return (
    <div className="space-y-3">
      <p id="pin-entry-title" className="text-sm font-medium">
        {pinEntryTitle(state.stage)}
      </p>
      <PinPad
        key={state.stage}
        onSubmit={onPin}
        status={message ? "error" : "idle"}
        message={message}
      />
    </div>
  );
}
