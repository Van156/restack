# Spec: Multi-tenant Authentication, User Management & Dynamic RBAC

- **Status:** Ready for review (all open questions resolved)
- **Date:** 2026-09-26
- **Stack:** Hono + oRPC (server), TanStack Router (web), Drizzle + Postgres, better-auth `1.7.5`

## 1. Objective

Provide a reusable base template where:

1. Users authenticate (already scaffolded: email + password).
2. Users belong to one or more **organizations** (tenants).
3. Organization admins **invite users by email** and assign roles.
4. Organization admins **create custom roles at runtime** from a code-defined permission catalog in `feature:action` form.
5. A **platform super admin** operates across all tenants (users, organizations, bans, impersonation).

## 2. Scope

### In scope

- better-auth `organization` plugin with **dynamic access control**.
- better-auth `admin` plugin for the platform layer.
- Code-defined permission catalog (`feature:action`), single source of truth.
- Email invitation flow behind an email-sending port.
- Server-side authorization middleware for oRPC procedures.
- Web UI: org switcher, members, invitations, roles editor, platform admin area.

### Out of scope (v1)

- Teams (sub-groups inside an organization).
- SSO / OAuth providers, 2FA, passkeys.
- Billing / plan limits.
- Resource-level (row/ABAC) permissions — v1 is role-based only.

## 3. Glossary

| Term                    | Meaning                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| **Platform layer**      | Operator-level scope across all tenants. Managed by the `admin` plugin; stored in `user.role`.      |
| **Tenant layer**        | Organization-scoped. Managed by the `organization` plugin; stored in `member.role`.                 |
| **Permission**          | A `feature:action` pair, e.g. `invoice:create`. Stored by better-auth as `{ invoice: ["create"] }`. |
| **Catalog**             | The full set of permissions the app supports. Defined in code only.                                 |
| **Built-in role**       | Code-defined org role: `owner`, `admin`, `member`. Not editable at runtime.                         |
| **Custom role**         | Org-defined role stored in `organizationRole`, built from a subset of the catalog.                  |
| **Active organization** | The organization bound to the current session (`session.activeOrganizationId`).                     |

## 4. Architecture

### 4.1 Two isolated permission layers

```
            ┌────────────────────────────────────────┐
Platform    │ admin plugin   user.role               │  superadmin | user
            │ catalog: platformAc (user, org, ...)   │
            └────────────────────────────────────────┘
            ┌────────────────────────────────────────┐
Tenant      │ organization plugin  member.role       │  owner | admin | member | <custom>
            │ catalog: orgAc (feature:action)        │
            │ custom roles → organizationRole table  │
            └────────────────────────────────────────┘
```

- The layers MUST NOT grant each other: a platform `superadmin` is **not** implicitly an org member, and an org `owner` has **no** platform permissions.
- Platform access to tenant data happens only through platform-scoped procedures or impersonation (audited).

### 4.2 Permission catalog (code)

Location: `packages/auth/src/permissions/` (shared by server and web).

```ts
// packages/auth/src/permissions/org.ts
import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  ownerAc,
  adminAc,
  memberAc,
} from "better-auth/plugins/organization/access";

export const orgStatements = {
  ...defaultStatements, // organization, member, invitation, ac
  audit: ["read"], // template feature: organization activity log (R7)
  // App features — extend here. Each key is a feature, each value its actions.
  project: ["create", "read", "update", "delete"],
} as const;

export const orgAc = createAccessControl(orgStatements);

export const owner = orgAc.newRole({
  ...ownerAc.statements,
  audit: ["read"],
  project: ["create", "read", "update", "delete"],
});
export const admin = orgAc.newRole({
  ...adminAc.statements,
  audit: ["read"],
  project: ["create", "read", "update", "delete"],
});
export const member = orgAc.newRole({ ...memberAc.statements, project: ["read"] });
```

Rules:

- Adding a feature = adding a key to `orgStatements` + granting it to built-in roles. No DB migration.
- Removing an action from the catalog MUST NOT break existing custom roles (unknown permissions are ignored on check and pruned by a maintenance task).
- `project` is an example feature; the template ships with it only to demonstrate the pattern.
- A helper exposes permissions as strings (`"project:create"`) for UI display; storage stays in better-auth's object shape.

### 4.3 Server configuration

```ts
emailAndPassword: { enabled: true, requireEmailVerification: true },
emailVerification: {
  sendOnSignUp: true,
  autoSignInAfterVerification: true,
  sendVerificationEmail: ({ user, url }) => emailSender.sendVerification({ to: user.email, url }),
},
user: {
  additionalFields: {
    // Per-user override set by a superadmin; null = use env default. Never writable by the user.
    maxOrganizations: { type: "number", required: false, input: false },
  },
},
organization({
  // true = limit reached (blocks creation). Counts organizations where the user is `owner`.
  organizationLimit: async (user) =>
    (await countOwnedOrganizations(user.id)) >= (user.maxOrganizations ?? env.DEFAULT_MAX_ORGS_PER_USER),
  ac: orgAc,
  roles: { owner, admin, member },
  dynamicAccessControl: { enabled: true, maximumRolesPerOrganization: 25 },
  sendInvitationEmail: (data) => emailSender.sendInvitation(...),
  invitationExpiresIn: 60 * 60 * 48,        // 48h
  requireEmailVerificationOnInvitation: true,
}),
admin({
  ac: platformAc,
  roles: { superadmin, user },
  defaultRole: "user",
  adminRoles: ["superadmin"],
}),
```

> API names follow the latest better-auth docs; verify each option against the installed `1.7.5` during implementation.

### 4.4 Email port (hexagonal)

```ts
interface EmailSender {
  sendInvitation(input: {
    to: string;
    inviterName: string;
    organizationName: string;
    acceptUrl: string;
  }): Promise<void>;
  sendVerification(input: { to: string; url: string }): Promise<void>;
}
```

- `ConsoleEmailSender` (dev/test): logs the link.
- `ResendEmailSender` (production): uses the Resend SDK; requires `RESEND_API_KEY` and `EMAIL_FROM` (verified sender domain).
- Adapter selected by env: `RESEND_API_KEY` present → Resend, otherwise Console. Auth code depends only on the port.
- Send failures are logged and surfaced as a retryable error; the invitation record stays `pending` so it can be resent.

### 4.5 oRPC authorization

Procedure builders in `packages/api`:

| Builder                                     | Guarantees                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `publicProcedure`                           | none                                                                                         |
| `protectedProcedure`                        | valid session                                                                                |
| `orgProcedure`                              | session + active organization + caller is a member; injects `ctx.org` and `ctx.member`       |
| `requirePermission({ feature: [actions] })` | middleware on top of `orgProcedure`; calls `auth.api.hasPermission` (includes dynamic roles) |
| `platformProcedure(permissions)`            | session + platform permission via `auth.api.userHasPermission`                               |

- **Every** tenant query MUST filter by `ctx.org.id`. Tenant ID never comes from client input.
- Client-side checks are UX only. The server is the authority.

## 5. Data model

Generated by better-auth CLI into `packages/db/src/schema/auth.ts`, then migrated with Drizzle.

| Table              | Source                         | Key fields                                                                                                                                                                                                                                                                                                  |
| ------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`             | core + admin + custom          | `role`, `banned`, `banReason`, `banExpires`, `maxOrganizations` (nullable int)                                                                                                                                                                                                                              |
| `session`          | core + org + admin             | `activeOrganizationId`, `impersonatedBy`                                                                                                                                                                                                                                                                    |
| `organization`     | org                            | `name`, `slug`, `logo`, `metadata`                                                                                                                                                                                                                                                                          |
| `member`           | org                            | `organizationId`, `userId`, `role` (comma-separated)                                                                                                                                                                                                                                                        |
| `invitation`       | org                            | `organizationId`, `email`, `role`, `status`, `expiresAt`, `inviterId`                                                                                                                                                                                                                                       |
| `organizationRole` | org (dynamic AC)               | `organizationId`, `role`, `permission` (JSON)                                                                                                                                                                                                                                                               |
| `audit_log`        | app (Drizzle, not better-auth) | `id`, `scope` (`platform` \| `organization`), `organizationId` (nullable), `actorUserId`, `impersonatorUserId` (nullable), `action`, `targetType`, `targetId`, `metadata` (JSONB), `ip`, `userAgent`, `createdAt`. Indexes: `(organizationId, createdAt)`, `(actorUserId, createdAt)`, `(scope, createdAt)` |

## 6. Requirements

### R0 — Sign-up & email verification

**R0.1 Verification required**

- GIVEN a user signs up with email + password (no invitation)
- THEN a verification email is sent and sign-in is refused until the email is verified.

**R0.2 Auto sign-in after verification**

- WHEN the user clicks a valid verification link
- THEN `emailVerified = true` and they are signed in and redirected to onboarding.

**R0.3 Resend link**

- GIVEN an unverified user on the "check your inbox" screen
- THEN they can request a new verification email (rate-limited, e.g. 1 per 60s).

**R0.4 Expired link**

- WHEN a verification link is expired or invalid
- THEN an error is shown with a "resend" action; nothing changes.

### R1 — Organizations

**R1.1 Create organization**

- GIVEN a signed-in user
- WHEN they create an organization with a name and unique slug
- THEN the organization exists, the user is its `owner`, and it becomes the active organization.

**R1.1a Who can create** — any user with a verified email; unverified users cannot create organizations.

**R1.1b Organization limit**

- GIVEN `DEFAULT_MAX_ORGS_PER_USER` (env, default `3`) and an optional per-user `maxOrganizations` override
- WHEN a user who already owns `limit` organizations tries to create another
- THEN creation fails with a "organization limit reached" error.
- The effective limit is `user.maxOrganizations ?? DEFAULT_MAX_ORGS_PER_USER`.
- Only organizations where the user is `owner` count; memberships from invitations do not consume the quota.

**R1.2 Slug uniqueness**

- WHEN a slug is already taken
- THEN creation fails with a validation error and nothing is persisted.

**R1.3 Switch active organization**

- GIVEN a user who belongs to organizations A and B
- WHEN they switch to B
- THEN `session.activeOrganizationId = B` and all tenant queries return only B's data.

**R1.4 Onboarding without organization**

- GIVEN a signed-in user with no memberships and no pending invitations
- WHEN they open the app
- THEN they are redirected to "create organization".

### R2 — Invitations

**R2.1 Invite**

- GIVEN a member with `invitation:create`
- WHEN they invite `email` with role `R`
- THEN a `pending` invitation is stored with a 48h expiry and an email with an accept link is sent.

**R2.2 Cannot invite above own privileges**

- WHEN the inviter assigns a role containing permissions they do not hold
- THEN the invitation is rejected.

**R2.3 Accept — existing user**

- GIVEN a signed-in, verified user whose email matches the invitation
- WHEN they open the accept link and confirm
- THEN they become a member with role `R` and the invitation is `accepted`.

**R2.4 Accept — new user**

- GIVEN the invited email has no account
- WHEN they open the link
- THEN they sign up with the email prefilled and locked.
- AND because the invitation link carries a single-use secret token sent only to that inbox (never the invitation ID, which the inviter can see), the server marks the account `emailVerified = true` (only when the invitation is `pending`, not expired, and its email matches exactly), signs them in, and accepts the invitation — no second verification email.
- Implementation note: custom logic, not built into better-auth (e.g. a sign-up endpoint/hook that receives the invitation ID and validates it server-side). The invitation ID from the client is never trusted without that check.

**R2.5 Email mismatch**

- WHEN the signed-in user's email differs from the invitation email
- THEN acceptance fails with a clear message and no membership is created.

**R2.6 Expired / cancelled / reused**

- WHEN an invitation is expired, cancelled, or already accepted
- THEN acceptance fails and no membership is created.

**R2.7 Cancel / resend**

- GIVEN a member with `invitation:cancel`
- THEN they can cancel a pending invitation; resending creates a new expiry.

**R2.8 Duplicate**

- WHEN inviting an email that is already a member or has a pending invitation
- THEN the action fails with a descriptive error.

### R3 — Members

**R3.1 List** — any member can list members of the active organization.

**R3.2 Change role** — a member with `member:update` can change another member's role, only to roles whose permissions they hold.

**R3.3 Remove** — a member with `member:delete` can remove another member; the removed user's sessions lose that active organization.

**R3.4 Last owner protection** — the last `owner` cannot be removed, demoted, or leave.

**R3.5 Leave** — a non-last-owner member can leave an organization.

### R4 — Dynamic roles

**R4.1 Create role**

- GIVEN a member with `ac:create`
- WHEN they create role `billing-manager` with `{ invoice: ["read", "create"] }`
- THEN it is stored in `organizationRole` scoped to the active organization and is assignable.

**R4.2 No privilege escalation**

- WHEN a role includes permissions the creator does not hold
- THEN creation/update fails.

**R4.3 Catalog validation**

- WHEN a role includes a `feature:action` not in the catalog
- THEN creation/update fails.

**R4.4 Built-in roles are immutable** — `owner`, `admin`, `member` cannot be updated or deleted; custom role names cannot collide with them.

**R4.5 Update role** — changes take effect on the next permission check for all members holding the role (no re-login).

**R4.6 Delete role in use** — deleting a role assigned to members or pending invitations fails until they are reassigned.

**R4.7 Tenant isolation** — custom roles of organization A are neither visible nor assignable in organization B.

**R4.8 Limit** — creating roles beyond `maximumRolesPerOrganization` fails.

### R5 — Authorization enforcement

**R5.1** Every tenant procedure uses `orgProcedure`; every mutating one declares `requirePermission`.

**R5.2** A request without the permission returns `FORBIDDEN`; without session `UNAUTHORIZED`; with no active organization a dedicated error code.

**R5.3** Web UI hides/disables actions using a `useCan("feature:action")` hook backed by server `hasPermission` (cached per active org + role); routes guard on the same check.

### R6 — Platform super admin

**R6.1 Bootstrap** — the first `superadmin` is assigned via a seed command using an env var (`PLATFORM_ADMIN_EMAILS`); never through a public endpoint.

**R6.2 List users & organizations** — `superadmin` can search/paginate all users and organizations.

**R6.3 Ban / unban** — `superadmin` can ban a user (with reason and optional expiry); banned users' sessions are revoked and sign-in is refused.

**R6.4 Impersonation** — `superadmin` can impersonate a non-superadmin user; the session carries `impersonatedBy`, a persistent banner is shown, and it ends on "stop impersonating" or after 1h.

**R6.5 Layer isolation** — platform routes (`/admin/*`) and procedures reject non-superadmins, including org owners.

**R6.6 Override organization limit**

- GIVEN a `superadmin` on `/admin/users/$id`
- WHEN they set `maxOrganizations` to a non-negative integer, or clear it to fall back to the default
- THEN the new limit applies to the user's next creation attempt. Lowering it below the current count blocks new creations but never deletes existing organizations.
- Users cannot set this field themselves (sign-up, profile update, or any client call).

**R6.7 Audit** — impersonation start/stop, bans, and organization-limit changes are recorded in `audit_log` with `scope = platform` (see R7).

### R7 — Audit log

**R7.1 Recorded events** — at minimum:

| Scope          | Actions                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `organization` | `organization.created/updated/deleted`, `member.added/role_changed/removed/left`, `invitation.created/cancelled/accepted/rejected`, `role.created/updated/deleted` |
| `platform`     | `user.banned/unbanned`, `user.impersonation_started/stopped`, `user.org_limit_changed`, `user.platform_role_changed`                                               |

**R7.2 Write path**

- Events are written from a single `AuditLogger` port (hexagonal), called from better-auth hooks (organization/member/invitation hooks, admin plugin hooks) and from oRPC procedures.
- The audit write happens in the same request as the action; if the action fails, no event is written.
- Actions performed while impersonating record both the impersonated user (`actorUserId`) and the superadmin (`impersonatorUserId`).
- `metadata` stores before/after values for changes (e.g. old/new role). Secrets, tokens, and passwords are never stored.

**R7.3 Append-only** — there is no update or delete API for audit entries; the app DB role has no `UPDATE`/`DELETE` on `audit_log` in production (recommended).

**R7.4 Organization activity view**

- GIVEN a member with `audit:read`
- THEN they can list (paginated, newest first, filter by action/actor/date) entries where `organizationId = ctx.org.id` only.
- Platform-scope entries are never visible to tenants.

**R7.5 Platform activity view** — a `superadmin` can list all entries (both scopes), filter by organization, actor, action, and date.

**R7.6 Retention** — configurable via `AUDIT_LOG_RETENTION_DAYS` (default: unlimited); a scheduled job purges older entries.

## 7. Web routes (TanStack Router)

| Route                                                      | Guard                 | Purpose                                                    |
| ---------------------------------------------------------- | --------------------- | ---------------------------------------------------------- |
| `/login`, `/signup`                                        | public                | existing                                                   |
| `/accept-invitation/$id`                                   | public → auth         | R2.3–R2.6                                                  |
| `/onboarding`                                              | session               | create first org (R1.4)                                    |
| `/_auth/_org/dashboard`                                    | session + active org  | existing dashboard, now tenant-scoped                      |
| `/_auth/_org/settings/general`                             | `organization:update` | org name/slug/logo                                         |
| `/_auth/_org/settings/members`                             | member                | list, change role, remove                                  |
| `/_auth/_org/settings/invitations`                         | `invitation:create`   | invite, cancel, resend                                     |
| `/_auth/_org/settings/roles`                               | `ac:read`             | roles list + editor (permission matrix grouped by feature) |
| `/_auth/_org/settings/activity`                            | `audit:read`          | organization audit log (R7.4)                              |
| `/admin/users`, `/admin/users/$id`, `/admin/organizations` | platform `superadmin` | R6                                                         |
| `/admin/activity`                                          | platform `superadmin` | platform audit log (R7.5)                                  |

## 8. Non-functional requirements

- **Security:** no tenant ID from client input; invitation IDs are opaque (default generator); email verification required before accepting invitations; rate-limit invite and sign-in endpoints.
- **Testing:** unit tests for the catalog helpers and middleware; integration tests against Postgres (docker) for every scenario in §6, especially R2.2, R3.4, R4.2, R4.7, R6.5.
- **DX:** adding a new feature's permissions is a single-file change in the catalog, documented in the README.

### Known limitations

- **R1.1b org-owner limit is best-effort under concurrency (T3.1f).** `organizationLimit` (`packages/auth/src/index.ts`) reads the caller's current owned-organization count and compares it to their effective limit; two concurrent `createOrganization` calls from the _same_ user can both pass this check before either insert commits, temporarily exceeding the limit by one. better-auth 1.7.5's organization plugin doesn't wrap `organizationLimit` → hooks → inserts in one transaction, and doesn't hand hooks a connection/context that a Postgres advisory lock could safely span (the Drizzle adapter's queries go through a pooled connection, so a lock acquired during `organizationLimit` has no guarantee of running on the same session as the later insert). Manually holding a dedicated connection open across the two non-adjacent hook callbacks involved would require keying shared mutable state by user id across concurrent requests — a new source of bugs, not a clean fix — so no safe fix ships in this version. This limit is a UX guardrail, not a security boundary: the realistic exploit window is a single user racing their own two requests, and it does not allow crossing an organization boundary or affect any other tenant.

## 9. Acceptance criteria

- [ ] All §6 scenarios covered by passing tests.
- [ ] A new feature permission can be added and enforced by editing only the catalog and one procedure.
- [ ] Cross-tenant access attempts return `FORBIDDEN` in tests.
- [ ] Dev flow works end to end with `ConsoleEmailSender` (invite link visible in server logs).
- [ ] Every R7.1 action produces exactly one `audit_log` entry, and tenants cannot read other tenants' or platform entries.
- [ ] Migrations generated and applied cleanly on an empty database.

## 10. Open questions

1. ~~Email provider for production~~ — **Resolved:** Resend (§4.4).
2. ~~Email verification at sign-up~~ — **Resolved:** required for all users; invited users are verified by the invitation link (R0, R2.4).
3. ~~Who can create organizations~~ — **Resolved:** any verified user, limited by `DEFAULT_MAX_ORGS_PER_USER` with a per-user superadmin override (R1.1a, R1.1b, R6.6).
4. ~~Audit log persistence~~ — **Resolved:** queryable, append-only `audit_log` table (R7).
