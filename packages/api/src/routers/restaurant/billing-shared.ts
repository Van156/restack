import type { LocationRow } from "../../lib/location-scope";
import { assertLocationAccess } from "../../lib/location-scope";
import { ORPCError } from "@orpc/server";

import { resolveActingMember, loadSessionInScope } from "./orders-shared";
import type { OrderContext, TableSessionRow } from "./orders-shared";

const WAITER_CANNOT_CHARGE = "This Location does not let waiters charge.";

/**
 * True when a Role may charge at the Location: any Role holding `billing:charge`, except a plain
 * Waiter, who also needs the Location's "waiters can charge" flag.
 */
export function roleMayCharge(role: string, location: LocationRow): boolean {
  const roles = role.split(",").map((value) => value.trim());
  if (roles.some((name) => name === "owner" || name === "admin" || name === "cashier")) {
    return true;
  }
  return roles.includes("waiter") ? location.waitersCanCharge : true;
}

/** A Table session with its Location, for billing procedures (Location access is checked). */
export async function loadChargeableSession(
  context: OrderContext,
  tableSessionId: string,
): Promise<{ session: TableSessionRow; location: LocationRow }> {
  const session = await loadSessionInScope(context, tableSessionId);
  const location = await assertLocationAccess(context, session.locationId);
  return { session, location };
}

/**
 * The member a charge is attributed to. The caller already holds `billing:charge`; a Waiter also
 * needs the Location flag. With an acting token the member who switched in must meet the same rules.
 */
export async function resolveChargingMemberId(
  context: OrderContext,
  location: LocationRow,
  actingToken: string | undefined,
): Promise<string> {
  if (!roleMayCharge(context.member.role, location)) {
    throw new ORPCError("FORBIDDEN", { message: WAITER_CANNOT_CHARGE });
  }
  if (actingToken === undefined) {
    return context.member.id;
  }
  const acting = await resolveActingMember(context, location.id, actingToken);
  if (!acting.permissions.billing?.includes("charge")) {
    throw new ORPCError("FORBIDDEN", { message: "This Staff member cannot charge." });
  }
  if (!roleMayCharge(acting.role, location)) {
    throw new ORPCError("FORBIDDEN", { message: WAITER_CANNOT_CHARGE });
  }
  return acting.id;
}
