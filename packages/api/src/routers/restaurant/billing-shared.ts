import {
  includesAllPermissions,
  resolveOrgRolePermissions,
} from "@base-template/auth/role-permissions";
import { parseRoles } from "@base-template/auth/role-names";
import type { LocationRow } from "../../lib/location-scope";
import { assertLocationAccess } from "../../lib/location-scope";
import { ORPCError } from "@orpc/server";

import { resolveActingMember, loadSessionInScope } from "./orders-shared";
import type { OrderContext, TableSessionRow } from "./orders-shared";

const WAITER_CANNOT_CHARGE = "This Location does not let waiters charge.";

/**
 * True when the Roles may charge at the Location: they must grant `billing:charge`, and a plain
 * Waiter also needs the Location's "waiters can charge" flag.
 */
async function rolesMayCharge(
  context: OrderContext,
  location: LocationRow,
  role: string,
  granted?: Record<string, string[]>,
): Promise<boolean> {
  const holdsCharge = (permissions: Record<string, string[]>) =>
    includesAllPermissions(permissions, { billing: ["charge"] });
  const resolve = (roleField: string) =>
    resolveOrgRolePermissions(context.db, context.org.id, roleField);

  if (!holdsCharge(granted ?? (await resolve(role)))) {
    return false;
  }
  const roles = parseRoles(role);
  if (!roles.includes("waiter") || location.waitersCanCharge) {
    return true;
  }
  return holdsCharge(await resolve(roles.filter((name) => name !== "waiter").join(",")));
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
  if (!(await rolesMayCharge(context, location, context.member.role))) {
    throw new ORPCError("FORBIDDEN", { message: WAITER_CANNOT_CHARGE });
  }
  if (actingToken === undefined && !context.offlineActor) {
    return context.member.id;
  }
  const acting = await resolveActingMember(context, location.id, actingToken);
  if (!includesAllPermissions(acting.permissions, { billing: ["charge"] })) {
    throw new ORPCError("FORBIDDEN", { message: "This Staff member cannot charge." });
  }
  if (!(await rolesMayCharge(context, location, acting.role, acting.permissions))) {
    throw new ORPCError("FORBIDDEN", { message: WAITER_CANNOT_CHARGE });
  }
  return acting.id;
}
