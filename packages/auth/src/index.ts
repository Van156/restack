import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema/auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { APIError, betterAuth } from "better-auth";
import type { BetterAuthPlugin } from "better-auth";
import { getOAuthState } from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import { organization } from "better-auth/plugins/organization";
import { and, eq, inArray, ne } from "drizzle-orm";

import { createAccountSecurity } from "./account-security";
import type { AccountSecurityEvents } from "./account-security";
import { createAuditAfterHook } from "./audit/after-hooks";
import { createUserAuditEvents } from "./audit/user-events";
import { currentAuditContext } from "./audit/request-context";
import type { AuditLogger } from "./audit/types";
import type { EmailSender } from "./email";
import {
  generateInvitationToken,
  hashInvitationToken,
  invitationSignUpIdentifier,
} from "./invitation-token";
import {
  hasReachedOwnedOrgLimit,
  TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS,
} from "./org-limit";
import { hasOwnerRole } from "./owner-role";
import { isBuiltInOrgRole, orgAc, orgRoles, platformAc, platformRoles } from "./permissions";
import type { PermissionsRecord } from "./permissions";
import { invitationSignUpPlugin } from "./plugins/invitation-sign-up";
import { resolveGoogleCredentials } from "./social-providers";
import type { SocialProviderEnv } from "./social-providers";

export type AuthConfig = SocialProviderEnv & {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  CORS_ORIGIN: string;
  /** Fallback org-ownership limit (R1.1b) when `user.maxOrganizations` is unset. */
  DEFAULT_MAX_ORGS_PER_USER: number;
};

/** Invitation link expiry (R2.1, spec §4.3): 48 hours. */
const INVITATION_EXPIRES_IN_SECONDS = 60 * 60 * 48;

/** Maximum custom roles a single organization may define (R4.8). */
const MAXIMUM_ROLES_PER_ORGANIZATION = 25;

/** Merges `source`'s `feature: [actions]` entries into `target` (in place, deduped via `Set`). */
function mergePermissionsInto(
  target: Record<string, Set<string>>,
  source: PermissionsRecord,
): void {
  for (const [feature, actions] of Object.entries(source)) {
    const set = target[feature] ?? (target[feature] = new Set());
    for (const action of actions) {
      set.add(action);
    }
  }
}

/**
 * Aggregates the permissions of comma-separated built-in or custom org roles. Unknown names grant
 * nothing; better-auth already validates role names before `beforeCreateInvitation` runs.
 */
async function resolveOrgRolePermissions(
  database: Database,
  organizationId: string,
  roleField: string,
): Promise<Record<string, string[]>> {
  const roleNames = roleField
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const permissions: Record<string, Set<string>> = {};
  for (const name of roleNames) {
    if (isBuiltInOrgRole(name)) {
      mergePermissionsInto(permissions, orgRoles[name].statements);
    }
  }

  const customRoleNames = roleNames.filter((name) => !isBuiltInOrgRole(name));
  if (customRoleNames.length > 0) {
    const customRoles = await database
      .select({ permission: schema.organizationRole.permission })
      .from(schema.organizationRole)
      .where(
        and(
          eq(schema.organizationRole.organizationId, organizationId),
          inArray(schema.organizationRole.role, customRoleNames),
        ),
      );
    for (const row of customRoles) {
      mergePermissionsInto(permissions, JSON.parse(row.permission) as PermissionsRecord);
    }
  }

  return Object.fromEntries(
    Object.entries(permissions).map(([feature, actions]) => [feature, [...actions]]),
  );
}

/** Whether every `feature:action` pair in `required` is also present in `granted` (R2.2 superset check). */
function includesAllPermissions(
  granted: Record<string, string[]>,
  required: Record<string, string[]>,
): boolean {
  return Object.entries(required).every(([feature, actions]) =>
    actions.every((action) => granted[feature]?.includes(action) ?? false),
  );
}

/** Reads a member's role field for one organization, or `null` when they are not a member. */
async function findMemberRole(
  database: Database,
  organizationId: string,
  userId: string,
): Promise<string | null> {
  const [row] = await database
    .select({ role: schema.member.role })
    .from(schema.member)
    .where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, userId)))
    .limit(1);
  return row?.role ?? null;
}

/**
 * R5.5: a Google sign-up carrying an invitation id may only create an account when the verified
 * email equals the invited one. The id is untrusted: it can only make sign-up stricter.
 * See docs/architecture/auth.md#invitation-email-match
 */
async function assertInvitedEmailMatchesOAuthUser(
  database: Database,
  user: { email: string; emailVerified: boolean },
): Promise<void> {
  // `getOAuthState` throws outside a request (scripts, tests): not an OAuth callback.
  const state = await getOAuthState().catch(() => null);
  const invitationId = (state as { invitationId?: unknown } | null)?.invitationId;
  if (typeof invitationId !== "string" || invitationId === "") {
    return;
  }
  const [invitation] = await database
    .select({
      email: schema.invitation.email,
      status: schema.invitation.status,
      expiresAt: schema.invitation.expiresAt,
    })
    .from(schema.invitation)
    .where(eq(schema.invitation.id, invitationId))
    .limit(1);
  if (
    !invitation ||
    invitation.status !== "pending" ||
    invitation.expiresAt.getTime() < Date.now()
  ) {
    return;
  }
  if (!user.emailVerified || invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new APIError("FORBIDDEN", {
      code: "INVITATION_EMAIL_MISMATCH",
      message:
        "The Google account's verified email does not match the email this invitation was sent to.",
    });
  }
}

export type CreateAuthOptions = {
  /** Additional trusted origins for desktop app builds (e.g. `tauri://localhost`). */
  desktopOrigins?: readonly string[];
  /** Test-only plugins (e.g. `testUtils()`); never passed in production. */
  extraPlugins?: readonly BetterAuthPlugin[];
  /**
   * Seams for account-security events (see `AccountSecurityEvents`). Defaults to the user-scoped
   * audit trail written through `auditLogger`; pass a custom set only to observe or replace it.
   */
  accountSecurityEvents?: AccountSecurityEvents;
};

/**
 * Audit actor/network context for hooks that receive no request `ctx`. Falls back to
 * `fallbackUserId` only when the request has no session.
 * See docs/architecture/auth.md#audit-hooks
 */
function resolveAuditActor(fallbackUserId: string) {
  const current = currentAuditContext();
  return {
    actorUserId: current.actorUserId ?? fallbackUserId,
    impersonatorUserId: current.impersonatorUserId,
    ip: current.ip,
    userAgent: current.userAgent,
  };
}

export function createAuth(
  env: AuthConfig,
  database: Database,
  emailSender: EmailSender,
  auditLogger: AuditLogger,
  options: CreateAuthOptions = {},
) {
  const {
    desktopOrigins = [],
    extraPlugins = [],
    accountSecurityEvents = createUserAuditEvents(auditLogger),
  } = options;

  // Also the base URL of email links (invitation accept links).
  const appUrl = env.CORS_ORIGIN;

  // R5.1: registered only when both values exist; half-configured throws at startup.
  const google = resolveGoogleCredentials(env);

  // R2, R3, R4, R6: change email, reset/change password, sessions, delete account.
  const accountSecurity = createAccountSecurity({
    database,
    emailSender,
    events: accountSecurityEvents,
  });

  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN, ...desktopOrigins],
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    // R5.4: an unverified Google email fails sign-in instead of getting a session.
    socialProviders: google
      ? {
          google: {
            clientId: google.clientId,
            clientSecret: google.clientSecret,
            requireEmailVerification: true,
          },
        }
      : {},
    // R5.4: link only when both provider and local emails are verified; no trusted providers.
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: [],
        requireLocalEmailVerified: true,
      },
    },
    databaseHooks: {
      user: {
        ...accountSecurity.databaseHooks.user,
        create: {
          before: async (user) => {
            await assertInvitedEmailMatchesOAuthUser(database, user);
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      // R0.1: sign-in is refused until the email is verified.
      requireEmailVerification: true,
      ...accountSecurity.emailAndPassword,
    },
    emailVerification: {
      // R0.1: send a verification email on sign-up.
      sendOnSignUp: true,
      // R0.2: sign the user in automatically once they verify.
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await emailSender.sendVerification({ to: user.email, url });
      },
    },
    user: {
      ...accountSecurity.user,
      additionalFields: {
        // R6.6: superadmin-only override; unset falls back to DEFAULT_MAX_ORGS_PER_USER.
        maxOrganizations: {
          type: "number",
          required: false,
          input: false,
        },
      },
    },
    plugins: [
      organization({
        ac: orgAc,
        roles: orgRoles,
        dynamicAccessControl: {
          enabled: true,
          maximumRolesPerOrganization: MAXIMUM_ROLES_PER_ORGANIZATION,
        },
        invitationExpiresIn: INVITATION_EXPIRES_IN_SECONDS,
        // R2.3: by-ID invitation actions (accept/reject/get) require a
        // verified session email.
        requireEmailVerificationOnInvitation: true,
        // R1.1a: only users with a verified email may create organizations.
        allowUserToCreateOrganization: (user) => Boolean(user.emailVerified),
        // R1.1b: true blocks creation. Best-effort under concurrency (spec §8).
        organizationLimit: (user) =>
          hasReachedOwnedOrgLimit(database, user.id, env.DEFAULT_MAX_ORGS_PER_USER),
        // The accept link carries a high-entropy token and only its hash is stored (R2.4).
        // See docs/architecture/auth.md#invitation-sign-up-flow
        sendInvitationEmail: async (data) => {
          const identifier = invitationSignUpIdentifier(data.id);
          const token = generateInvitationToken();
          const tokenHash = hashInvitationToken(token);

          // Send before writing the new token so a failed send leaves the old link working.
          await emailSender.sendInvitation({
            to: data.email,
            inviterName: data.inviter.user.name,
            organizationName: data.organization.name,
            acceptUrl: `${appUrl}/accept-invitation/${data.id}?token=${token}`,
          });

          // Insert before deleting so the "most recent row wins" lookup never sees zero valid rows.
          await database.insert(schema.verification).values({
            id: crypto.randomUUID(),
            identifier,
            value: tokenHash,
            expiresAt: data.invitation.expiresAt,
          });
          await database
            .delete(schema.verification)
            .where(
              and(
                eq(schema.verification.identifier, identifier),
                ne(schema.verification.value, tokenHash),
              ),
            );
        },
        organizationHooks: {
          // R2.2: an inviter cannot assign a role exceeding their own, custom roles included;
          // better-auth only checks the owner case.
          beforeCreateInvitation: async ({ invitation, inviter }) => {
            const inviterRole = await findMemberRole(
              database,
              invitation.organizationId,
              inviter.id,
            );
            const [inviterPermissions, invitedPermissions] = await Promise.all([
              resolveOrgRolePermissions(database, invitation.organizationId, inviterRole ?? ""),
              resolveOrgRolePermissions(database, invitation.organizationId, invitation.role),
            ]);
            if (!includesAllPermissions(inviterPermissions, invitedPermissions)) {
              throw new APIError("FORBIDDEN", {
                code: "INVITER_LACKS_INVITED_ROLE_PERMISSIONS",
                message: "You cannot invite someone to a role with permissions you do not hold.",
              });
            }
          },
          // R9.1: promoting a member to owner counts toward the target's owned-org limit
          // (R1.1b). `newRole` is better-auth's comma-joined role string.
          beforeUpdateMemberRole: async ({ member, newRole, user }) => {
            if (!hasOwnerRole(newRole) || hasOwnerRole(member.role)) return;
            if (await hasReachedOwnedOrgLimit(database, user.id, env.DEFAULT_MAX_ORGS_PER_USER)) {
              throw new APIError("FORBIDDEN", {
                code: TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS,
                message: "This user has reached their organization ownership limit.",
              });
            }
          },
          // Audit write path (R7.1, R7.2). See docs/architecture/auth.md#audit-hooks
          afterCreateOrganization: async ({ organization, user }) => {
            await auditLogger.record({
              scope: "organization",
              organizationId: organization.id,
              ...resolveAuditActor(user.id),
              action: "organization.created",
              targetType: "organization",
              targetId: organization.id,
              metadata: {
                organizationName: organization.name,
                slug: organization.slug,
                actorEmail: user.email,
              },
            });
          },
          afterUpdateOrganization: async ({ organization, user, member }) => {
            // `organization` may be null when the adapter returns no row; the member always has the id.
            const organizationId = organization?.id ?? member.organizationId;
            await auditLogger.record({
              scope: "organization",
              organizationId,
              ...resolveAuditActor(user.id),
              action: "organization.updated",
              targetType: "organization",
              targetId: organizationId,
              metadata: {
                organizationName: organization?.name,
                slug: organization?.slug,
                actorEmail: user.email,
              },
            });
          },
          // Written before the delete: the audit row's org id is nulled once the org is gone, so
          // the name snapshot keeps it readable, and a failed write blocks the deletion.
          beforeDeleteOrganization: async ({ organization, user }) => {
            await auditLogger.record({
              scope: "organization",
              organizationId: organization.id,
              ...resolveAuditActor(user.id),
              action: "organization.deleted",
              targetType: "organization",
              targetId: organization.id,
              metadata: {
                organizationName: organization.name,
                slug: organization.slug,
                actorEmail: user.email,
              },
            });
          },
          // Not fired for invitation acceptance; `afterAcceptInvitation` records that instead.
          afterAddMember: async ({ member, user, organization }) => {
            await auditLogger.record({
              scope: "organization",
              organizationId: organization.id,
              ...resolveAuditActor(user.id),
              action: "member.added",
              targetType: "member",
              targetId: member.id,
              metadata: {
                organizationName: organization.name,
                memberUserId: user.id,
                memberEmail: user.email,
                role: member.role,
              },
            });
          },
          afterUpdateMemberRole: async ({ member, previousRole, user, organization }) => {
            await auditLogger.record({
              scope: "organization",
              organizationId: organization.id,
              ...resolveAuditActor(user.id),
              action: "member.role_changed",
              targetType: "member",
              targetId: member.id,
              metadata: {
                organizationName: organization.name,
                memberUserId: member.userId,
                previousRole,
                newRole: member.role,
              },
            });
          },
          // `user` is the removed member, not the caller.
          afterRemoveMember: async ({ member, user, organization }) => {
            await auditLogger.record({
              scope: "organization",
              organizationId: organization.id,
              ...resolveAuditActor(user.id),
              action: "member.removed",
              targetType: "member",
              targetId: member.id,
              metadata: {
                organizationName: organization.name,
                memberUserId: user.id,
                memberEmail: user.email,
                role: member.role,
              },
            });
          },
          afterCreateInvitation: async ({ invitation, inviter, organization }) => {
            await auditLogger.record({
              scope: "organization",
              organizationId: organization.id,
              ...resolveAuditActor(inviter.id),
              action: "invitation.created",
              targetType: "invitation",
              targetId: invitation.id,
              metadata: {
                organizationName: organization.name,
                invitedEmail: invitation.email,
                role: invitation.role,
              },
            });
          },
          afterCancelInvitation: async ({ invitation, cancelledBy, organization }) => {
            await auditLogger.record({
              scope: "organization",
              organizationId: organization.id,
              ...resolveAuditActor(cancelledBy.id),
              action: "invitation.cancelled",
              targetType: "invitation",
              targetId: invitation.id,
              metadata: { organizationName: organization.name, invitedEmail: invitation.email },
            });
          },
          // Also recorded directly by `invitation-sign-up.ts`, which has no native hook (R2.4).
          afterAcceptInvitation: async ({ invitation, user, organization }) => {
            await auditLogger.record({
              scope: "organization",
              organizationId: organization.id,
              ...resolveAuditActor(user.id),
              action: "invitation.accepted",
              targetType: "invitation",
              targetId: invitation.id,
              metadata: {
                organizationName: organization.name,
                actorEmail: user.email,
                role: invitation.role,
              },
            });
          },
          afterRejectInvitation: async ({ invitation, user, organization }) => {
            await auditLogger.record({
              scope: "organization",
              organizationId: organization.id,
              ...resolveAuditActor(user.id),
              action: "invitation.rejected",
              targetType: "invitation",
              targetId: invitation.id,
              metadata: { organizationName: organization.name, actorEmail: user.email },
            });
          },
        },
      }),
      admin({
        ac: platformAc,
        roles: platformRoles,
        defaultRole: "user",
        adminRoles: ["superadmin"],
        // R6.4: 1h, matching better-auth's default but pinned against upstream drift.
        impersonationSessionDuration: 60 * 60,
      }),
      invitationSignUpPlugin(auditLogger),
      accountSecurity.plugin,
      ...extraPlugins,
    ],
    // R7.1 actions with no native hook; better-auth has one `hooks.after` slot, matched by path.
    // See docs/architecture/auth.md#audit-hooks
    hooks: {
      after: createAuditAfterHook(auditLogger),
    },
  });
}

export { countOwnedOrganizations, hasReachedOwnedOrgLimit } from "./org-limit";

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
