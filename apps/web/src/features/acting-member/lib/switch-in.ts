import { formatAge } from "@base-template/ui/lib/format-age";

import { toActing, type Acting, type SwitchInResult } from "./acting-member";
import type { OfflineSwitchInResult } from "./offline-switch-in";
import { pinFailure, type PinFailure } from "./pin-failure";

export type SwitchInOutcome =
  | { status: "ok"; acting: Acting }
  | { status: "failed"; failure: PinFailure };

type Deps = {
  online: boolean;
  /** `staff.switchIn`: the server checks the PIN. */
  remote: (memberId: string, pin: string) => Promise<SwitchInResult>;
  /** The device checks the PIN against its stored material. */
  offline: (memberId: string, pin: string) => Promise<OfflineSwitchInResult>;
  isNetworkFailure: (error: unknown) => boolean;
  /** Feeds connectivity detection when the request never reached the server. */
  onNetworkFailure: () => void;
  now: () => Date;
};

function offlineFailure(
  result: Exclude<OfflineSwitchInResult, { status: "ok" }>,
  now: Date,
): PinFailure {
  switch (result.status) {
    case "wrong_pin":
      return {
        status: "error",
        message:
          result.attemptsLeft === 1
            ? "PIN incorrecto. Te queda 1 intento."
            : `PIN incorrecto. Te quedan ${result.attemptsLeft} intentos.`,
      };
    case "locked":
      return {
        status: "locked",
        message: `Demasiados intentos. Vuelve a intentarlo en ${formatAge(result.until.getTime() - now.getTime())}.`,
      };
    case "no_material":
      return {
        status: "error",
        message: "Este dispositivo no tiene el PIN de esta persona. Entra una vez con conexión.",
      };
  }
}

/**
 * Switches a member in: through the server while online, through the device's stored PIN material
 * while offline or when the connection drops mid-request. A refusal from a reached server is
 * final; it is never retried against the offline material.
 */
export async function runSwitchIn(
  deps: Deps,
  memberId: string,
  pin: string,
): Promise<SwitchInOutcome> {
  if (deps.online) {
    try {
      return { status: "ok", acting: toActing(await deps.remote(memberId, pin)) };
    } catch (error) {
      if (!deps.isNetworkFailure(error)) {
        return { status: "failed", failure: pinFailure(error) };
      }
      deps.onNetworkFailure();
    }
  }
  const result = await deps.offline(memberId, pin);
  return result.status === "ok"
    ? result
    : { status: "failed", failure: offlineFailure(result, deps.now()) };
}
