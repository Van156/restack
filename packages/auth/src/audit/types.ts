// Audit log port (spec §5, R7). Lives in `@base-template/auth` so hooks and `@base-template/api`
// can both use `AuditLogger` without a dependency cycle. See docs/architecture/audit-log.md.

import type { OrganizationAuditAction, PlatformAuditAction, UserAuditAction } from "./actions";

/**
 * `audit_log.scope` (§5, R7.1): `organization` entries are tenant-scoped, `platform` ones are
 * operator-level, `user` ones are a person's own security trail (never tenant-visible, R7.3).
 */
export type AuditScope = "platform" | "organization" | "user";

export type { OrganizationAuditAction, PlatformAuditAction, UserAuditAction } from "./actions";

export type AuditAction = OrganizationAuditAction | PlatformAuditAction | UserAuditAction;

/** Fields common to every audit event, regardless of scope. */
type AuditEventBase = {
  /** The acting user. The column is nullable only for `ON DELETE SET NULL`; a write always knows it. */
  actorUserId: string;
  /** Set only when the actor's session was impersonated by a superadmin (R7.2, R6.7). */
  impersonatorUserId?: string | null;
  /** e.g. "organization", "member", "invitation", "organizationRole", "user". */
  targetType: string;
  targetId: string;
  /** Before/after values plus a readable snapshot (`actorEmail`, ...) that outlives deleted rows. MUST NEVER contain secrets, tokens or passwords (R7.2). */
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

/** One event to record. Discriminated on `scope` at compile time, mirroring the DB check constraint. */
export type AuditEvent =
  | (AuditEventBase & {
      scope: "organization";
      organizationId: string;
      action: OrganizationAuditAction;
    })
  | (AuditEventBase & {
      scope: "platform";
      organizationId?: null;
      action: PlatformAuditAction;
    })
  | (AuditEventBase & {
      scope: "user";
      organizationId?: null;
      action: UserAuditAction;
    });

/** Audit port (R7.2). Implementations MUST NOT silently drop a failed write. */
export interface AuditLogger {
  record(event: AuditEvent): Promise<void>;
}
