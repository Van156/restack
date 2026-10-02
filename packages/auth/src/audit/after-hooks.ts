import { createAuthMiddleware } from "@better-auth/core/api";
import { APIError } from "@better-auth/core/error";
import { getSessionFromCtx } from "better-auth/api";

import { extractRequestMeta } from "./request-context";
import type { AuditLogger, PlatformAuditAction } from "./types";

type SessionShape = {
  session: { userId: string; impersonatedBy?: string | null; activeOrganizationId?: string | null };
  user: { id: string; email?: string; name?: string };
} | null;

/**
 * The single `hooks.after` handler (R7.1): records the actions better-auth exposes no hook for
 * (dynamic roles, `/organization/leave`, admin plugin), matched by `ctx.path` on better-auth 1.7.5.
 * Runs on every request; a failed endpoint writes nothing (R7.2).
 * See docs/architecture/audit-log.md#after-hook.
 */
export function createAuditAfterHook(auditLogger: AuditLogger) {
  return createAuthMiddleware(async (ctx) => {
    const path = ctx.path;
    if (!path) {
      return;
    }

    // `returned` is the thrown APIError itself when the endpoint failed (hooks.after still runs).
    const returned = ctx.context.returned;
    if (returned instanceof APIError) {
      return;
    }

    // `ctx.context.session` does not reliably survive on this context; re-derive from cookies.
    const resolved = ctx.context.session ?? (await getSessionFromCtx(ctx).catch(() => null));
    const session = (resolved ?? null) as SessionShape;
    const { ip, userAgent } = extractRequestMeta(ctx.headers ?? null);
    const actorUserId = session?.user.id ?? null;
    const impersonatorUserId = session?.session.impersonatedBy ?? null;

    switch (path) {
      case "/organization/leave": {
        const body = ctx.body as { organizationId?: string } | undefined;
        if (!actorUserId || !body?.organizationId) {
          return;
        }
        await auditLogger.record({
          scope: "organization",
          organizationId: body.organizationId,
          actorUserId,
          impersonatorUserId,
          ip,
          userAgent,
          action: "member.left",
          targetType: "member",
          targetId: actorUserId,
          metadata: { memberUserId: actorUserId, memberEmail: session?.user.email },
        });
        return;
      }

      case "/organization/create-role": {
        const body = ctx.body as { organizationId?: string; role?: string } | undefined;
        // Same active-organization fallback as better-auth's handler.
        const organizationId = body?.organizationId ?? session?.session.activeOrganizationId;
        if (!actorUserId || !organizationId || !body?.role) {
          return;
        }
        await auditLogger.record({
          scope: "organization",
          organizationId,
          actorUserId,
          impersonatorUserId,
          ip,
          userAgent,
          action: "role.created",
          targetType: "organizationRole",
          targetId: body.role,
          metadata: { role: body.role },
        });
        return;
      }

      case "/organization/update-role":
      case "/organization/delete-role": {
        const body = ctx.body as
          | { organizationId?: string; roleName?: string; roleId?: string }
          | undefined;
        const organizationId = body?.organizationId ?? session?.session.activeOrganizationId;
        const targetId = body?.roleId ?? body?.roleName;
        if (!actorUserId || !organizationId || !targetId) {
          return;
        }
        await auditLogger.record({
          scope: "organization",
          organizationId,
          actorUserId,
          impersonatorUserId,
          ip,
          userAgent,
          action: path === "/organization/update-role" ? "role.updated" : "role.deleted",
          targetType: "organizationRole",
          targetId,
          metadata: { roleName: body?.roleName, roleId: body?.roleId },
        });
        return;
      }

      case "/admin/ban-user":
      case "/admin/unban-user": {
        const body = ctx.body as { userId?: string; banReason?: string } | undefined;
        const targetUser = (returned as { user?: { email?: string; name?: string } } | undefined)
          ?.user;
        if (!actorUserId || !body?.userId) {
          return;
        }
        await auditLogger.record({
          scope: "platform",
          actorUserId,
          impersonatorUserId,
          ip,
          userAgent,
          action: path === "/admin/ban-user" ? "user.banned" : "user.unbanned",
          targetType: "user",
          targetId: body.userId,
          metadata: {
            targetEmail: targetUser?.email,
            targetName: targetUser?.name,
            banReason: body.banReason,
          },
        });
        return;
      }

      case "/admin/set-role": {
        const body = ctx.body as { userId?: string; role?: string | string[] } | undefined;
        const targetUser = (returned as { user?: { email?: string } } | undefined)?.user;
        if (!actorUserId || !body?.userId) {
          return;
        }
        await auditLogger.record({
          scope: "platform",
          actorUserId,
          impersonatorUserId,
          ip,
          userAgent,
          action: "user.platform_role_changed",
          targetType: "user",
          targetId: body.userId,
          metadata: { targetEmail: targetUser?.email, newRole: body.role },
        });
        return;
      }

      case "/admin/update-user": {
        const body = ctx.body as { userId?: string; data?: Record<string, unknown> } | undefined;
        const targetUser = returned as { email?: string } | undefined;
        if (!actorUserId || !body?.userId || !body.data) {
          return;
        }
        const hasKey = (key: string) => Object.prototype.hasOwnProperty.call(body.data, key);
        const events: Array<{ action: PlatformAuditAction; metadata: Record<string, unknown> }> =
          [];
        if (hasKey("maxOrganizations")) {
          events.push({
            action: "user.org_limit_changed",
            metadata: {
              targetEmail: targetUser?.email,
              newMaxOrganizations: body.data.maxOrganizations,
            },
          });
        }
        if (hasKey("role")) {
          events.push({
            action: "user.platform_role_changed",
            metadata: { targetEmail: targetUser?.email, newRole: body.data.role },
          });
        }
        if (hasKey("banned")) {
          events.push({
            action: body.data.banned ? "user.banned" : "user.unbanned",
            metadata: { targetEmail: targetUser?.email },
          });
        }
        for (const event of events) {
          await auditLogger.record({
            scope: "platform",
            actorUserId,
            impersonatorUserId,
            ip,
            userAgent,
            targetType: "user",
            targetId: body.userId,
            ...event,
          });
        }
        return;
      }

      case "/admin/impersonate-user": {
        const body = ctx.body as { userId?: string } | undefined;
        const targetUser = (returned as { user?: { email?: string } } | undefined)?.user;
        if (!actorUserId || !body?.userId) {
          return;
        }
        await auditLogger.record({
          scope: "platform",
          actorUserId,
          impersonatorUserId,
          ip,
          userAgent,
          action: "user.impersonation_started",
          targetType: "user",
          targetId: body.userId,
          metadata: { targetEmail: targetUser?.email },
        });
        return;
      }

      case "/admin/stop-impersonating": {
        // The cached session is still the impersonated one: `userId` is the target and
        // `impersonatedBy` the real actor, the reverse of every other case here.
        const impersonatedUserId = session?.session.userId ?? null;
        const superadminId = session?.session.impersonatedBy ?? null;
        if (!impersonatedUserId || !superadminId) {
          return;
        }
        await auditLogger.record({
          scope: "platform",
          actorUserId: superadminId,
          // Ending impersonation is the superadmin's own act, not one done while impersonating.
          impersonatorUserId: null,
          ip,
          userAgent,
          action: "user.impersonation_stopped",
          targetType: "user",
          targetId: impersonatedUserId,
          metadata: { targetEmail: session?.user.email },
        });
        return;
      }

      default:
        return;
    }
  });
}
