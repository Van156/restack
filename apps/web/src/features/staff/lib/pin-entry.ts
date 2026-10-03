export type PinStage = "current" | "new" | "confirm";

export type PinEntryState = {
  stage: PinStage;
  currentPin?: string;
  newPin?: string;
  message?: string;
};

export type PinSubmission = { pin: string; currentPin: string | undefined };

/** A change asks for the current PIN first; the first PIN and an Administrator's reset do not. */
export function startPinEntry(requireCurrent: boolean): PinEntryState {
  return { stage: requireCurrent ? "current" : "new" };
}

const TITLES: Record<PinStage, string> = {
  current: "Escribe tu PIN actual",
  new: "Escribe el nuevo PIN (4 a 6 dígitos)",
  confirm: "Repite el nuevo PIN",
};

export function pinEntryTitle(stage: PinStage): string {
  return TITLES[stage];
}

/** Feeds one PIN into the flow; `submit` is set once the new PIN was typed twice identically. */
export function advancePinEntry(
  state: PinEntryState,
  pin: string,
): { state: PinEntryState; submit?: PinSubmission } {
  switch (state.stage) {
    case "current":
      return { state: { stage: "new", currentPin: pin } };
    case "new":
      return { state: { stage: "confirm", currentPin: state.currentPin, newPin: pin } };
    case "confirm":
      if (pin === state.newPin) {
        return { state, submit: { pin, currentPin: state.currentPin } };
      }
      return {
        state: {
          stage: "new",
          currentPin: state.currentPin,
          message: "Los PIN no coinciden. Empieza de nuevo.",
        },
      };
  }
}
