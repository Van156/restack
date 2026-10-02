import type { AccountSecurityEvents } from "../account-security";
import { currentAuditContext } from "./request-context";
import type { AuditLogger, UserAuditAction } from "./types";

/**
 * Production implementation of the account-security seams: one `scope = "user"` audit row per
 * event (account-and-org-settings R2.4, R3.5, R4.2, R4.3, R6.4). The actor and the target are the
 * user; `metadata.actorEmail` snapshots the address so the row stays readable after the user
 * (and the `actor_user_id` reference) is gone. IP and user agent describe the request that caused
 * the event. Metadata never holds passwords or tokens; sessions are identified by row id only.
 * See docs/architecture/audit-log.md#user-scope.
 */
export function createUserAuditEvents(auditLogger: AuditLogger): AccountSecurityEvents {
  function record(
    action: UserAuditAction,
    user: { userId: string; email: string },
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const request = currentAuditContext();
    return auditLogger.record({
      scope: "user",
      action,
      actorUserId: user.userId,
      impersonatorUserId: request.impersonatorUserId,
      ip: request.ip,
      userAgent: request.userAgent,
      targetType: "user",
      targetId: user.userId,
      metadata: { actorEmail: user.email, ...metadata },
    });
  }

  return {
    emailChanged: ({ previousEmail, ...user }) =>
      record("user.email_changed", user, { oldEmail: previousEmail, newEmail: user.email }),
    // The other sessions were revoked as part of the change; recorded here, not as one
    // `user.session_revoked` row each (those are for user-initiated revokes).
    passwordChanged: (user) =>
      record("user.password_changed", user, { otherSessionsRevoked: true }),
    passwordReset: (user) => record("user.password_reset", user, { allSessionsRevoked: true }),
    sessionRevoked: async ({ sessions, ...user }) => {
      // Sequential, one row per session, in the order better-auth listed them. The logger has no
      // batch write, so this is not atomic: a failure mid-loop leaves the earlier rows written
      // and the rest missing. Callers treat user events as best-effort, so the trail may be
      // partial for a multi-session revoke (the revocation itself has already happened).
      for (const session of sessions) {
        await record("user.session_revoked", user, {
          sessionId: session.id,
          sessionUserAgent: session.userAgent,
          sessionIp: session.ipAddress,
          sessionCreatedAt: session.createdAt.toISOString(),
        });
      }
    },
    // Awaited BEFORE the delete: a rejection aborts the deletion (R6.4).
    userDeleting: ({ name, ...user }) => record("user.deleted", user, { userName: name }),
  };
}
