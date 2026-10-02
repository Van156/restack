import { ORPCError, os } from "@orpc/server";

import type { OrgPermissions, PlatformPermissions } from "./authorization";
import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

const requireAuth = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({
    context: {
      session: context.session,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireAuth);

/** 409, not 403: a client-fixable state ("pick an organization"), distinct from `FORBIDDEN` (R5.2). */
const NO_ACTIVE_ORGANIZATION_STATUS = 409;

/**
 * Protected + requires an active organization the caller belongs to. Injects `context.org` and
 * `context.member` from the session, never from client input (R5.1).
 * See docs/architecture/authorization.md#org-procedures
 */
export const orgProcedure = protectedProcedure.use(async ({ context, next }) => {
  // Read from the session row to tell "none selected" from "no longer a member" without a port call.
  if (!context.session.session.activeOrganizationId) {
    throw new ORPCError("NO_ACTIVE_ORGANIZATION", {
      status: NO_ACTIVE_ORGANIZATION_STATUS,
      message: "No active organization selected.",
    });
  }

  const membership = await context.authorization.getActiveMembership(context.headers);
  if (!membership) {
    throw new ORPCError("FORBIDDEN", {
      message: "You are not a member of the active organization.",
    });
  }

  return next({
    context: {
      org: { id: membership.organizationId },
      member: { id: membership.memberId, role: membership.role },
    },
  });
});

/**
 * Middleware factory: `orgProcedure.use(requirePermission({ feature: ["action"] }))`. Typed against
 * `orgStatements`; denied maps to `FORBIDDEN` (R4, R5.1).
 */
export function requirePermission(permissions: OrgPermissions) {
  return o.middleware(async ({ context, next }) => {
    const allowed = await context.authorization.hasOrgPermission(
      context.headers,
      // Cast only drops compile-time literal types; the runtime value is unchanged.
      permissions as Record<string, string[]>,
    );
    if (!allowed) {
      throw new ORPCError("FORBIDDEN", {
        message: "Missing required organization permission.",
      });
    }
    return next();
  });
}

/**
 * Protected + requires a platform permission; org roles grant none (R6.5).
 * See docs/architecture/authorization.md#platform-procedures
 */
export function platformProcedure(permissions: PlatformPermissions) {
  return protectedProcedure.use(async ({ context, next }) => {
    const allowed = await context.authorization.hasPlatformPermission(
      context.session.user.id,
      permissions as Record<string, string[]>,
    );
    if (!allowed) {
      throw new ORPCError("FORBIDDEN", {
        message: "Missing required platform permission.",
      });
    }
    return next();
  });
}
