export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;

export type PinAction =
  | { type: "digit"; digit: string }
  | { type: "backspace" }
  | { type: "clear" };

/** Next PIN after an action; digits past the maximum length are ignored. */
export function reducePin(pin: string, action: PinAction): string {
  switch (action.type) {
    case "digit":
      return /^\d$/.test(action.digit) && pin.length < PIN_MAX_LENGTH ? pin + action.digit : pin;
    case "backspace":
      return pin.slice(0, -1);
    case "clear":
      return "";
  }
}

/** Whether the PIN has a valid length (4 to 6 digits). */
export function canSubmitPin(pin: string): boolean {
  return pin.length >= PIN_MIN_LENGTH && pin.length <= PIN_MAX_LENGTH;
}

/** One bullet per digit entered. */
export function maskPin(pin: string): string {
  return "•".repeat(pin.length);
}

/** The pad action for a physical key, or null when the key does nothing. */
export function pinActionForKey(key: string): PinAction | { type: "submit" } | null {
  if (/^\d$/.test(key)) {
    return { type: "digit", digit: key };
  }
  switch (key) {
    case "Backspace":
      return { type: "backspace" };
    case "Escape":
      return { type: "clear" };
    case "Enter":
      return { type: "submit" };
    default:
      return null;
  }
}
