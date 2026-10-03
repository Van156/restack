import type { GuestReasonId, GuestResponse, GuestState } from "./guest-client";

/** How often the page asks for the state. The per-token read limit (120 a minute) is shared by every guest of a Table. */
export const GUEST_POLL_MS = 5_000;

const INVALID_MESSAGE = "Este código QR no es válido. Pídele a tu mesero el código de tu mesa.";
const CALL_OPEN_NOTICE = "Ya avisamos a tu mesero. Espera un momento.";
const STALE_NOTICE = "No pudimos actualizar. Seguimos intentando.";

/** Whole seconds until `target`, rounded up so a running countdown never reads 0 early. */
export function secondsLeft(target: Date, now: Date): number {
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 1000));
}

export type GuestView =
  | { kind: "loading" }
  | { kind: "unreachable" }
  | { kind: "closed"; message: string }
  | { kind: "offline"; message: string }
  | { kind: "expired"; message: string }
  | { kind: "invalid"; message: string }
  | { kind: "throttled"; seconds: number }
  | {
      kind: "open";
      tableName: string;
      reasons: readonly { id: GuestReasonId; label: string }[];
      canCall: boolean;
      call: { reasonLabel: string; onTheWay: boolean } | null;
      /** Seconds left of the pause after an attended call, or null when there is none. */
      cooldownSeconds: number | null;
      notice: string | null;
    };

function openView(
  state: Extract<GuestState, { status: "open" }>,
  now: Date,
  notice: string | null,
): GuestView {
  const cooldownEnd = state.cooldownUntil ? new Date(state.cooldownUntil) : null;
  const remaining = cooldownEnd ? secondsLeft(cooldownEnd, now) : 0;
  const cooling = remaining > 0;
  const label = state.call
    ? (state.reasons.find((reason) => reason.id === state.call?.reason)?.label ?? "Tu llamada")
    : null;
  return {
    kind: "open",
    tableName: state.table.name,
    reasons: state.reasons,
    canCall: state.call === null && !cooling && (state.canCall || cooldownEnd !== null),
    call:
      state.call && label
        ? { reasonLabel: label, onTheWay: state.call.status === "on_the_way" }
        : null,
    cooldownSeconds: cooling ? remaining : null,
    notice,
  };
}

function stateView(state: GuestState, now: Date, notice: string | null): GuestView {
  switch (state.status) {
    case "closed":
      return { kind: "closed", message: state.message };
    case "offline":
      return { kind: "offline", message: state.message };
    case "open":
      return openView(state, now, notice);
  }
}

/**
 * What the page shows for the last answer. Countdowns run from `now`, so a stale answer still
 * ticks down; `refreshFailed` keeps the last answer and adds a notice.
 */
export function guestView({
  last,
  receivedAt,
  now,
  refreshFailed,
}: {
  last: GuestResponse | null;
  receivedAt: Date;
  now: Date;
  refreshFailed: boolean;
}): GuestView {
  if (!last) {
    return refreshFailed ? { kind: "unreachable" } : { kind: "loading" };
  }
  const stale = refreshFailed ? STALE_NOTICE : null;
  switch (last.kind) {
    case "state":
      return stateView(last.state, now, stale);
    case "expired":
      return { kind: "expired", message: last.message };
    case "invalid":
      return { kind: "invalid", message: INVALID_MESSAGE };
    case "throttled": {
      const until = new Date(receivedAt.getTime() + last.retryAfterSeconds * 1000);
      return { kind: "throttled", seconds: secondsLeft(until, now) };
    }
    case "refused": {
      if (last.reason === "call_open") {
        return stateView(last.state, now, CALL_OPEN_NOTICE);
      }
      if (last.reason === "cooldown") {
        return stateView(
          last.state,
          now,
          "Tu mesero ya atendió tu llamada. Podrás llamar de nuevo en unos segundos.",
        );
      }
      return stateView(last.state, now, null);
    }
  }
}

/** Delay before the next poll, or false when the page can no longer change (Table closed, bad or expired code). */
export function guestPollDelay(last: GuestResponse | undefined): number | false {
  if (!last) {
    return GUEST_POLL_MS;
  }
  switch (last.kind) {
    case "expired":
    case "invalid":
      return false;
    case "throttled":
      return Math.max(GUEST_POLL_MS, last.retryAfterSeconds * 1000);
    case "state":
    case "refused":
      return last.state.status === "closed" ? false : GUEST_POLL_MS;
  }
}
