import { hasOwnerRole } from "@base-template/auth/owner-role";
import { resolveOrgRolePermissions } from "@base-template/auth/role-permissions";
import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { Clock } from "../../context";
import { verifyActingToken } from "../../lib/acting-token";
import { assertLocationAccess } from "../../lib/location-scope";
import type { LocationScopeContext } from "../../lib/location-scope";

/** What the order procedures read from the context after `orgProcedure`. */
export type OrderContext = LocationScopeContext & {
  db: Database;
  clock: Clock;
  actingTokenSecret: string;
  session: { user: { id: string } };
  auditLogger: import("@base-template/auth/audit").AuditLogger;
};

/** Optional acting token from `staff.switchIn`: records the action as made by that member. */
export const actingTokenInput = z.string().min(1).optional();

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
 * The member an action is attributed to. Without a token it is the session's member. With one it
 * is the member who switched in by PIN: the token must be genuine, unexpired and bound to this
 * organization and Location, and that member must still work here and be allowed to take orders.
 * A raw member id from input is never trusted; an invalid token is FORBIDDEN, never ignored.
 */
export async function resolveActingMemberId(
  context: OrderContext,
  locationId: string,
  actingToken: string | undefined,
): Promise<string> {
  if (actingToken === undefined) {
    return context.member.id;
  }
  const claims = verifyActingToken(context.actingTokenSecret, actingToken, context.clock.now());
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
      throw new ORPCError("FORBIDDEN", { message: INVALID_ACTING_TOKEN });
    }
  }
  const permissions = await resolveOrgRolePermissions(context.db, context.org.id, acting.role);
  if (!permissions.order?.includes("take")) {
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
