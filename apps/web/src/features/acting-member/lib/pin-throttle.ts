import { createJsonSlot, type SlotStorage } from "./json-slot";

/** Wrong offline PINs before a member is locked out on this device. */
export const MAX_PIN_ATTEMPTS = 5;
/** How long the lockout lasts. */
export const LOCKOUT_MS = 15 * 60 * 1000;

type MemberState = { failures: number; lockedUntil: number | null };
type State = Record<string, MemberState>;

export type ThrottleCheck = { locked: false } | { locked: true; until: Date };

export function throttleKey(organizationId: string, locationId: string): string {
  return `restack:offline-pin-throttle:${organizationId}:${locationId}`;
}

function parseState(raw: unknown): State | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return undefined;
  }
  const state: State = {};
  for (const [memberId, value] of Object.entries(raw)) {
    const entry = value as Partial<MemberState> | null;
    if (typeof entry?.failures !== "number") {
      return undefined;
    }
    state[memberId] = {
      failures: entry.failures,
      lockedUntil: typeof entry.lockedUntil === "number" ? entry.lockedUntil : null,
    };
  }
  return state;
}

/** Per-member offline PIN throttle kept in storage. See docs/architecture/restaurant.md#offline-pin. */
export function createPinThrottle(storage: SlotStorage, key: string) {
  const slot = createJsonSlot(storage, key, parseState);
  const load = (): State => slot.read() ?? {};

  return {
    check(memberId: string, now: Date): ThrottleCheck {
      const lockedUntil = load()[memberId]?.lockedUntil;
      return lockedUntil !== null && lockedUntil !== undefined && now.getTime() < lockedUntil
        ? { locked: true, until: new Date(lockedUntil) }
        : { locked: false };
    },
    /** Wrong PINs this member may still type before the lockout. */
    attemptsLeft(memberId: string, now: Date): number {
      const current = load()[memberId];
      const expired = current?.lockedUntil != null && now.getTime() >= current.lockedUntil;
      return Math.max(0, MAX_PIN_ATTEMPTS - (expired ? 0 : (current?.failures ?? 0)));
    },
    recordFailure(memberId: string, now: Date): void {
      const state = load();
      const current = state[memberId];
      // A finished lockout starts a fresh count.
      const expired = current?.lockedUntil != null && now.getTime() >= current.lockedUntil;
      const failures = (expired ? 0 : (current?.failures ?? 0)) + 1;
      state[memberId] =
        failures >= MAX_PIN_ATTEMPTS
          ? { failures, lockedUntil: now.getTime() + LOCKOUT_MS }
          : { failures, lockedUntil: null };
      slot.write(state);
    },
    recordSuccess(memberId: string): void {
      const { [memberId]: _cleared, ...others } = load();
      slot.write(others);
    },
  };
}
