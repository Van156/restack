import { toOfflineActing, type Acting } from "./acting-member";
import { materialFor, type StoredCredentials } from "./offline-credentials";
import type { OfflineMaterial, OfflineScope, OfflineSigner } from "./offline-pin-crypto";
import type { createPinThrottle } from "./pin-throttle";

export type OfflineSwitchInResult =
  | { status: "ok"; acting: Acting }
  | { status: "wrong_pin"; attemptsLeft: number }
  | { status: "locked"; until: Date }
  | { status: "no_material" };

type Deps = {
  credentials: StoredCredentials | undefined;
  throttle: ReturnType<typeof createPinThrottle>;
  /** `openOfflineSigner`; injected so the throttle logic is tested without scrypt. */
  open: (
    material: OfflineMaterial,
    pin: string,
    scope: OfflineScope,
  ) => Promise<OfflineSigner | null>;
  scope: OfflineScope;
  now: Date;
};

/**
 * Switches a member in without a connection: their PIN is checked against the sealed material this
 * device stored, throttled per member (5 wrong PINs lock them for 15 minutes) and without ever
 * trying the PIN while locked. A member with no stored material is not counted.
 */
export async function switchInOffline(
  deps: Deps,
  memberId: string,
  pin: string,
): Promise<OfflineSwitchInResult> {
  const material = materialFor(deps.credentials, memberId);
  if (!material) {
    return { status: "no_material" };
  }
  const before = deps.throttle.check(memberId, deps.now);
  if (before.locked) {
    return { status: "locked", until: before.until };
  }
  const signer = await deps.open(material, pin, deps.scope);
  if (signer) {
    deps.throttle.recordSuccess(memberId);
    return {
      status: "ok",
      acting: toOfflineActing({
        material,
        signer,
        locationId: deps.scope.locationId,
        now: deps.now,
      }),
    };
  }
  deps.throttle.recordFailure(memberId, deps.now);
  const after = deps.throttle.check(memberId, deps.now);
  if (after.locked) {
    return { status: "locked", until: after.until };
  }
  return { status: "wrong_pin", attemptsLeft: deps.throttle.attemptsLeft(memberId, deps.now) };
}
