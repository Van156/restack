import * as schema from "@base-template/db/schema";
import type {
  WaiterCallReason,
  WaiterCallStatus,
} from "@base-template/db/schema/restaurant-waiter-call";
import { and, desc, eq } from "drizzle-orm";

import type { Clock } from "../context";
import type { DbExecutor } from "./executor";
import { isLocationOnline } from "./location-presence";
import { verifyTableSessionToken } from "./table-session-token";
import type { TableSessionTokenClaims } from "./table-session-token";

/** Pause after a call is attended before the same Table session can call again. */
export const WAITER_CALL_COOLDOWN_MS = 30 * 1000;

/** Guest-facing reasons; the labels are the copy the page shows. */
export const GUEST_REASONS: readonly { id: WaiterCallReason; label: string }[] = [
  { id: "need_something", label: "Necesito algo" },
  { id: "cutlery_napkins", label: "Más cubiertos o servilletas" },
  { id: "pay", label: "Quiero pagar" },
];

export const EXPIRED_MESSAGE = "Este código QR venció. Escanea el código actual de tu mesa.";
export const CLOSED_MESSAGE = "Esta mesa ya cerró. Gracias por venir.";
export const OFFLINE_MESSAGE = "El restaurante está sin conexión. Llama a tu mesero con la mano.";

export type GuestDeps = { db: DbExecutor; clock: Clock; secret: string };

/** What the public page may know: the call function and nothing else. */
export type GuestState =
  | { status: "closed"; message: string }
  | { status: "offline"; message: string }
  | {
      status: "open";
      table: { name: string };
      reasons: typeof GUEST_REASONS;
      call: { reason: WaiterCallReason; status: Exclude<WaiterCallStatus, "attended"> } | null;
      cooldownUntil: string | null;
      canCall: boolean;
    };

export type GuestStateResult =
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "state"; state: GuestState };

export type GuestCallResult =
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "refused"; reason: "closed" | "offline" | "call_open"; state: GuestState }
  | { kind: "refused"; reason: "cooldown"; state: GuestState; retryAfterSeconds: number }
  | { kind: "created"; state: GuestState };

type SessionRow = NonNullable<Awaited<ReturnType<typeof findSession>>>;
type TokenSession =
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "session"; row: SessionRow };

function findSession(deps: GuestDeps, claims: TableSessionTokenClaims) {
  return deps.db
    .select({ session: schema.tableSession, tableName: schema.diningTable.name })
    .from(schema.tableSession)
    .innerJoin(schema.diningTable, eq(schema.diningTable.id, schema.tableSession.tableId))
    .where(
      and(
        eq(schema.tableSession.id, claims.tableSessionId),
        eq(schema.tableSession.organizationId, claims.organizationId),
        eq(schema.tableSession.locationId, claims.locationId),
        eq(schema.tableSession.tokenVersion, claims.version),
      ),
    )
    .then(([row]) => row ?? null);
}

/**
 * The session a token stands for: signed, unexpired, still the current QR version and matching
 * the stored session. A signed token past its expiry on a still-open session is `expired`; every
 * other failure is `invalid`, indistinguishable from a missing session.
 */
async function resolveToken(deps: GuestDeps, token: string): Promise<TokenSession> {
  const verdict = verifyTableSessionToken(deps.secret, token, deps.clock.now());
  if (!verdict.ok && verdict.reason === "malformed") {
    return { kind: "invalid" };
  }
  const row = await findSession(deps, verdict.claims);
  if (!row) {
    return { kind: "invalid" };
  }
  if (verdict.ok) {
    return { kind: "session", row };
  }
  return row.session.status === "settled" ? { kind: "invalid" } : { kind: "expired" };
}

async function stateOf(deps: GuestDeps, row: SessionRow, fingerprint: string): Promise<GuestState> {
  const { session, tableName } = row;
  if (session.status === "settled") {
    return { status: "closed", message: CLOSED_MESSAGE };
  }
  if (!(await isLocationOnline(deps.db, deps.clock, session.locationId))) {
    return { status: "offline", message: OFFLINE_MESSAGE };
  }
  const [latest] = await deps.db
    .select()
    .from(schema.waiterCall)
    .where(
      and(
        eq(schema.waiterCall.tableSessionId, session.id),
        eq(schema.waiterCall.guestFingerprint, fingerprint),
      ),
    )
    .orderBy(desc(schema.waiterCall.createdAt))
    .limit(1);
  const unfinished = latest && latest.status !== "attended" ? latest : null;
  const cooling =
    latest?.cooldownUntil && latest.cooldownUntil.getTime() > deps.clock.now().getTime()
      ? latest.cooldownUntil
      : null;
  return {
    status: "open",
    table: { name: tableName },
    reasons: GUEST_REASONS,
    call: unfinished
      ? { reason: unfinished.reason, status: unfinished.status as "open" | "on_the_way" }
      : null,
    cooldownUntil: cooling ? cooling.toISOString() : null,
    canCall: !unfinished && !cooling,
  };
}

/** The guest page state for a token. See docs/architecture/restaurant.md#waiter-call. */
export async function getGuestState(
  deps: GuestDeps,
  token: string,
  fingerprint: string,
): Promise<GuestStateResult> {
  const resolved = await resolveToken(deps, token);
  return resolved.kind === "session"
    ? { kind: "state", state: await stateOf(deps, resolved.row, fingerprint) }
    : resolved;
}

/**
 * Creates the guest's call unless the Table closed, the Location is offline, a call is already
 * open for this guest or their cooldown runs. The partial unique index decides a race between two
 * taps of the same guest.
 */
export async function createGuestCall(
  deps: GuestDeps,
  token: string,
  input: { reason: WaiterCallReason; fingerprint: string },
): Promise<GuestCallResult> {
  const resolved = await resolveToken(deps, token);
  if (resolved.kind !== "session") {
    return resolved;
  }
  const { row } = resolved;
  const before = await stateOf(deps, row, input.fingerprint);
  if (before.status !== "open") {
    return { kind: "refused", reason: before.status, state: before };
  }
  if (before.call) {
    return { kind: "refused", reason: "call_open", state: before };
  }
  if (before.cooldownUntil) {
    const remainingMs = new Date(before.cooldownUntil).getTime() - deps.clock.now().getTime();
    return {
      kind: "refused",
      reason: "cooldown",
      state: before,
      retryAfterSeconds: Math.ceil(remainingMs / 1000),
    };
  }
  const { session } = row;
  const [created] = await deps.db
    .insert(schema.waiterCall)
    .values({
      organizationId: session.organizationId,
      locationId: session.locationId,
      tableSessionId: session.id,
      reason: input.reason,
      createdAt: deps.clock.now(),
      guestFingerprint: input.fingerprint,
    })
    .onConflictDoNothing()
    .returning({ id: schema.waiterCall.id });
  const after = await stateOf(deps, row, input.fingerprint);
  return created
    ? { kind: "created", state: after }
    : { kind: "refused", reason: "call_open", state: after };
}
