/**
 * The R7.1 action catalogue as runtime values (pure: no drizzle or better-auth import, so the
 * browser can import it through `@base-template/auth/audit/actions`). `types.ts` derives the
 * action types from these lists, so the catalogue and the compile-time types cannot drift.
 */

/** Organization-scoped R7.1 actions. */
export const ORGANIZATION_AUDIT_ACTIONS = [
  "organization.created",
  "organization.updated",
  "organization.deleted",
  "member.added",
  "member.role_changed",
  "member.removed",
  "member.left",
  "invitation.created",
  "invitation.cancelled",
  "invitation.accepted",
  "invitation.rejected",
  "role.created",
  "role.updated",
  "role.deleted",
] as const;

/** Platform-scoped R7.1 actions. */
export const PLATFORM_AUDIT_ACTIONS = [
  "user.banned",
  "user.unbanned",
  "user.impersonation_started",
  "user.impersonation_stopped",
  "user.org_limit_changed",
  "user.platform_role_changed",
] as const;

/** User-scoped actions (account security events, spec account-and-org-settings R2.4, R3.5, R4, R6.4). */
export const USER_AUDIT_ACTIONS = [
  "user.email_changed",
  "user.password_changed",
  "user.password_reset",
  "user.session_revoked",
  "user.deleted",
] as const;

export type OrganizationAuditAction = (typeof ORGANIZATION_AUDIT_ACTIONS)[number];
export type PlatformAuditAction = (typeof PLATFORM_AUDIT_ACTIONS)[number];
export type UserAuditAction = (typeof USER_AUDIT_ACTIONS)[number];
