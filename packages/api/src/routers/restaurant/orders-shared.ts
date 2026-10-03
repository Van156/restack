import { hasOwnerRole } from "@base-template/auth/owner-role";
import { resolveOrgRolePermissions } from "@base-template/auth/role-permissions";
import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { Clock } from "../../context";
import { MAX_OFFLINE_TOKEN_AGE_MS, verifyActingToken } from "../../lib/acting-token";
import { assertLocationAccess } from "../../lib/location-scope";
import { deriveOfflineKey, verifyOfflineMac } from "../../lib/offline-actor";
import type { LocationScopeContext } from "../../lib/location-scope";

/** What the order procedures read from the context after `orgProcedure`. */
export type OrderContext = LocationScopeContext & {
  db: Database;
  clock: Clock;
  actingTokenSecret: string;
  /**
   * Set for a synced offline record: acting tokens are checked at this instant (the record's
   * device time, never after the server clock) instead of at the server's now.
   */
  actingTokenValidAt?: Date;
  /** Set for a synced record with an `offlineActor`: attributed to that member once verified. */
  offlineActor?: OfflineActorClaim;
  session: { user: { id: string } };
  auditLogger: import("@base-template/auth/audit").AuditLogger;
};

/** Who a synced record claims entered a PIN offline, with the record the mac signs. */
export type OfflineActorClaim = {
  memberId: string;
  epoch: number;
  mac: string;
  idempotencyKey: string;
  kind: string;
  /** As sent, not clamped: the mac covers it. */
  deviceRecordedAt: Date;
};

/** `data.reason` values of a refused offline actor (the device refreshes its material on stale). */
export const OFFLINE_ACTOR_REASON = {
  invalid: "offline_actor_invalid",
  stale: "offline_actor_stale",
  expired: "offline_actor_expired",
} as const;

/** Optional acting token from `staff.switchIn`: records the action as made by that member. */
export const actingTokenInput = z.string().min(1).optional();

/** Client-generated key that makes a recorded action safe to retry. */
export const idempotencyKey = z.string().trim().min(1).max(100);

const SHORT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SHORT_CODE_LENGTH = 5;

/** A short, human-readable code for a Table session (no look-alike characters). */
export function generateShortCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SHORT_CODE_LENGTH));
  return Array.from(bytes, (byte) => SHORT_CODE_ALPHABET[byte % SHORT_CODE_ALPHABET.length]).join(
    "",
  );
}

export type TableSessionRow = typeof schema.tableSession.$inferSelect;

/** Loads a Table session of the caller's organization and checks access to its Location. */
export async function loadSessionInScope(
  context: OrderContext,
  tableSessionId: string,
): Promise<TableSessionRow> {
  const [row] = await context.db
    .select()
    .from(schema.tableSession)
    .where(
      and(
        eq(schema.tableSession.id, tableSessionId),
        eq(schema.tableSession.organizationId, context.org.id),
      ),
    );
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Table session not found." });
  }
  await assertLocationAccess(context, row.locationId);
  return row;
}

/** Lines, voids and discounts can only change while the Table session is unsettled. */
export function assertSessionUnsettled(session: TableSessionRow): void {
  if (session.status === "settled") {
    throw new ORPCError("CONFLICT", { message: "This Table session is already settled." });
  }
}

const INVALID_ACTING_TOKEN = "The acting token is invalid, expired or not for this Location.";

/**
 * The instant a token's expiry is checked: the server's now online, the record's device time for
 * a synced one. A device time older than the offline window is checked as expired.
 */
function actingTokenCheckTime(context: OrderContext): Date {
  const now = context.clock.now();
  const at = context.actingTokenValidAt;
  if (!at) {
    return now;
  }
  if (now.getTime() - at.getTime() > MAX_OFFLINE_TOKEN_AGE_MS) {
    return now;
  }
  return at.getTime() > now.getTime() ? now : at;
}

/** A member verified from an acting token, with their resolved Role permissions. */
export type ActingMember = {
  id: string;
  role: string;
  permissions: Awaited<ReturnType<typeof resolveOrgRolePermissions>>;
};

/**
 * The member who switched in, verified for this Location: a valid token, a member of the
 * organization still assigned to the Location. An invalid token is FORBIDDEN, never ignored.
 */
export async function resolveActingMember(
  context: OrderContext,
  locationId: string,
  actingToken: string | undefined,
): Promise<ActingMember> {
  if (actingToken === undefined) {
    return resolveOfflineActor(context, locationId, context.offlineActor!);
  }
  const claims = verifyActingToken(
    context.actingTokenSecret,
    actingToken,
    actingTokenCheckTime(context),
  );
  if (!claims || claims.organizationId !== context.org.id || claims.locationId !== locationId) {
    throw new ORPCError("FORBIDDEN", { message: INVALID_ACTING_TOKEN });
  }
  const [acting] = await context.db
    .select({ id: schema.member.id, role: schema.member.role })
    .from(schema.member)
    .where(
      and(eq(schema.member.id, claims.memberId), eq(schema.member.organizationId, context.org.id)),
    );
  if (!acting) {
    throw new ORPCError("FORBIDDEN", { message: INVALID_ACTING_TOKEN });
  }
  return loadActingMember(
    context,
    locationId,
    acting,
    new ORPCError("FORBIDDEN", { message: INVALID_ACTING_TOKEN }),
  );
}

/** The member must still work at the Location (the Owner always does); adds Role permissions. */
async function loadActingMember(
  context: OrderContext,
  locationId: string,
  acting: { id: string; role: string },
  refusal: ORPCError<string, unknown>,
): Promise<ActingMember> {
  if (!hasOwnerRole(acting.role)) {
    const [assignment] = await context.db
      .select({ id: schema.staffLocationAssignment.id })
      .from(schema.staffLocationAssignment)
      .where(
        and(
          eq(schema.staffLocationAssignment.memberId, acting.id),
          eq(schema.staffLocationAssignment.locationId, locationId),
        ),
      );
    if (!assignment) {
      throw refusal;
    }
  }
  const permissions = await resolveOrgRolePermissions(context.db, context.org.id, acting.role);
  return { id: acting.id, role: acting.role, permissions };
}

function refuseOfflineActor(
  reason: (typeof OFFLINE_ACTOR_REASON)[keyof typeof OFFLINE_ACTOR_REASON],
) {
  return new ORPCError("FORBIDDEN", {
    message: "The offline Staff entry could not be verified.",
    data: { reason },
  });
}

/** Verifies an offline actor's age, epoch, mac and assignment. See restaurant.md#offline-pin. */
async function resolveOfflineActor(
  context: OrderContext,
  locationId: string,
  claim: OfflineActorClaim,
): Promise<ActingMember> {
  const age = context.clock.now().getTime() - claim.deviceRecordedAt.getTime();
  if (age > MAX_OFFLINE_TOKEN_AGE_MS) {
    throw refuseOfflineActor(OFFLINE_ACTOR_REASON.expired);
  }
  const [row] = await context.db
    .select({
      id: schema.member.id,
      role: schema.member.role,
      epoch: schema.staffPin.offlineEpoch,
    })
    .from(schema.member)
    .innerJoin(schema.staffPin, eq(schema.staffPin.memberId, schema.member.id))
    .where(
      and(eq(schema.member.id, claim.memberId), eq(schema.member.organizationId, context.org.id)),
    );
  if (!row) {
    throw refuseOfflineActor(OFFLINE_ACTOR_REASON.invalid);
  }
  if (row.epoch !== claim.epoch) {
    throw refuseOfflineActor(OFFLINE_ACTOR_REASON.stale);
  }
  const offlineKey = deriveOfflineKey(context.actingTokenSecret, {
    organizationId: context.org.id,
    locationId,
    memberId: row.id,
    binding: context.member.id,
    epoch: row.epoch,
  });
  const signed = {
    idempotencyKey: claim.idempotencyKey,
    kind: claim.kind,
    deviceRecordedAtMs: claim.deviceRecordedAt.getTime(),
  };
  const macValid = verifyOfflineMac(offlineKey, signed, claim.mac);
  offlineKey.fill(0);
  if (!macValid) {
    throw refuseOfflineActor(OFFLINE_ACTOR_REASON.invalid);
  }
  return loadActingMember(
    context,
    locationId,
    row,
    refuseOfflineActor(OFFLINE_ACTOR_REASON.invalid),
  );
}

/**
 * The member an order action is attributed to: the session's, or with a valid acting token the
 * member who switched in (who must hold `order:take`). A raw member id is never trusted.
 */
export async function resolveActingMemberId(
  context: OrderContext,
  locationId: string,
  actingToken: string | undefined,
): Promise<string> {
  if (actingToken === undefined && !context.offlineActor) {
    return context.member.id;
  }
  const acting = await resolveActingMember(context, locationId, actingToken);
  if (!acting.permissions.order?.includes("take")) {
    throw new ORPCError("FORBIDDEN", { message: "This Staff member cannot take orders." });
  }
  return acting.id;
}

export type OrderLineRow = typeof schema.orderLine.$inferSelect;

/** Loads an Order line of the caller's organization with its session, checking Location access. */
export async function loadLineInScope(
  context: OrderContext,
  lineId: string,
): Promise<{ line: OrderLineRow; session: TableSessionRow }> {
  const [line] = await context.db
    .select()
    .from(schema.orderLine)
    .where(
      and(eq(schema.orderLine.id, lineId), eq(schema.orderLine.organizationId, context.org.id)),
    );
  if (!line) {
    throw new ORPCError("NOT_FOUND", { message: "Order line not found." });
  }
  return { line, session: await loadSessionInScope(context, line.tableSessionId) };
}

/** The void a client already recorded under this idempotency key, if any (a replay). */
export async function findVoidByKey(context: OrderContext, key: string, lineId: string) {
  const [replay] = await context.db
    .select()
    .from(schema.orderLineVoid)
    .where(
      and(
        eq(schema.orderLineVoid.organizationId, context.org.id),
        eq(schema.orderLineVoid.idempotencyKey, key),
      ),
    );
  if (replay && replay.orderLineId !== lineId) {
    throw new ORPCError("CONFLICT", { message: "This idempotency key was already used." });
  }
  return replay;
}

/** True when the line was sent to the kitchen (it sits on a Ticket). */
export async function isLineSent(context: OrderContext, lineId: string): Promise<boolean> {
  const [row] = await context.db
    .select({ ticketId: schema.ticketLine.ticketId })
    .from(schema.ticketLine)
    .where(eq(schema.ticketLine.orderLineId, lineId));
  return Boolean(row);
}
