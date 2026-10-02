# Spec: Account Settings & Organization Lifecycle

- **Status:** Approved (all decisions in §10 resolved)
- **Date:** 2026-10-01
- **Stack:** better-auth 1.7.5 (organization + admin plugins), oRPC, Drizzle/Postgres, React 19, TanStack Router + Query, `@tanstack/react-form` + zod, `packages/ui`, Storybook, `bun:test`
- **Depends on:** `auth-multitenant-rbac.md` (roles, R1.1b org limit, R3.4 last-owner protection, audit log), `dashboard-shell-and-auth-ui.md` (shell, user menu, auth pages), `data-table.md` (list pages), `frontend-foundation.md` (feature structure, import boundaries).

## 1. Objective

Give the B2B starter the self-service settings every product built on it needs:

1. **Account settings**: a personal area where a signed-in user manages their profile, email, password, sessions, theme, and can delete their account, plus the missing forgot-password flow and a user-scoped security log.
2. **Organization lifecycle**: transfer ownership, leave, and delete an organization from the existing org settings.

Delivered as two features in order: `account-settings` (§7 R1–R7), then `org-lifecycle` (§7 R8–R11).

## 2. Scope

### In scope

- `/account/*` area outside the org layout: Profile, Security (email, password, sessions, security log), Preferences, Danger zone.
- Forgot-password and reset-password public pages.
- New `EmailSender` methods and templates for reset password, change-email approval, delete-account confirmation, and password-changed notice.
- New `user` audit scope and account audit actions.
- Admin user detail "Activity" tab for user-scoped events.
- Org settings General danger zone: transfer ownership, leave, delete.
- R1.1b org-limit enforcement on promotion to owner and on transfer.

### Out of scope

- File storage, avatar and org logo uploads (initials fallback only; a separate base feature).
- Linking or unlinking Google from account settings.
- Server-persisted preferences (theme stays client-side).
- Soft delete or grace periods for accounts or organizations.
- Single-owner model; multiple owners remain allowed.
- Billing, notifications, API keys.

## 3. Glossary

| Term                    | Meaning                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| **Account area**        | Routes under `/account/*`, available to any signed-in user regardless of org membership.   |
| **Security event**      | Email change, password change, password reset, session revoke, account delete.             |
| **User-scoped audit**   | `audit_log` row with `scope = "user"` and `organizationId = NULL`; target is the user.     |
| **Last owner**          | The only member with role `owner` in an organization (R3.4 of `auth-multitenant-rbac.md`). |
| **Danger zone**         | A visually separated section for destructive, confirmed actions.                           |
| **Credential password** | A better-auth `credential` account; Google-only users do not have one.                     |

## 4. Decisions summary

The full list with rationale is in §10. Key ones:

- Account settings live at `/account/*`, not inside the org-scoped `/settings`.
- Change email requires approval from the **old** address, then verification of the **new** one.
- Google-only users obtain a password through the forgot-password email link, not an in-app form.
- Account deletion is confirmed by email link, then hard-deleted; blocked while the user is the last owner of any org.
- Multiple owners stay; "transfer ownership" is one atomic procedure: promote target to owner, demote caller to admin.
- Org deletion is confirmed by typing the org name, then hard-deleted.

## 5. Current state (base-template)

Verified 2026-10-01.

- **Auth** (`packages/auth/src/index.ts`): email/password with `requireEmailVerification`; optional Google; `emailVerification` configured. `sendResetPassword`, `changeEmail`, and `deleteUser` are **not** configured. No session-management UI.
- **Email** (`packages/auth/src/email/`): `EmailSender` port with `sendInvitation` and `sendVerification`; Resend and console adapters chosen by `factory.ts`.
- **Storage**: none.
- **Web**: org settings at `routes/_auth/_org/settings/` (general, members, invitations, roles, activity). General only renames and changes slug. User menu shows email and Sign out only. Theme via `app/providers/theme-provider.tsx` and `shared/components/layout/mode-toggle.tsx`. No account routes. Onboarding (create org) at `routes/_auth/_onboarding/onboarding.tsx`. Admin user detail at `routes/_auth/admin/users.$id.tsx`.
- **Roles** (`packages/auth/src/permissions/org.ts`): built-in `owner`, `admin`, `member`; owner holds `organization:delete`, admin holds `organization:update`. Multiple owners are possible; R3.4 protects the last one.
- **Org limit** (R1.1b): owned orgs count toward `user.maxOrganizations` / `DEFAULT_MAX_ORGS_PER_USER`; checked on create only. Promotion to owner is believed unchecked (confirm with a failing test, §9).
- **Audit** (`packages/db/src/schema/audit.ts`): `audit_log_scope` enum is `["platform", "organization"]`; FKs use `set null`, so rows survive user/org deletion with `metadata.actorEmail`. Org lifecycle events are already recorded; account events are not.

## 6. Design

### 6.1 Routes

```
routes/
├── _public-auth/
│   ├── forgot-password.tsx           # request reset link
│   └── reset-password.tsx            # ?token= — set new password
├── _auth/
│   ├── account/
│   │   ├── route.tsx                 # account layout + SectionNav (no org required)
│   │   ├── profile.tsx               # name; initials avatar
│   │   ├── security.tsx              # email, password, sessions, security log
│   │   ├── preferences.tsx           # theme
│   │   └── danger.tsx                # delete account
│   ├── _org/settings/general.tsx     # + danger zone: transfer, leave, delete
│   └── admin/users.$id.tsx           # + Activity tab (scope = user)
```

`/account` is reachable from the user menu ("Account settings") in both header and sidebar variants. It sits under `_auth` but not `_org`, so users without an org (e.g. after leaving their last one) can reach it.

### 6.2 Feature placement

- `apps/web/src/features/account/` — components, hooks, schemas for the account area.
- `apps/web/src/features/organizations/` — danger-zone components and lifecycle hooks.
- `packages/auth/src/email/` — new port methods, templates, both adapters.
- `packages/auth/src/audit/` — `user` scope actions and hooks.
- `packages/api/src/routers/` — `organization.transferOwnership` procedure; user-audit list procedures (self and admin).

### 6.3 Email port additions

```ts
interface EmailSender {
  sendInvitation(...): Promise<void>;          // existing
  sendVerification(...): Promise<void>;        // existing
  sendResetPassword(input: { to: string; url: string }): Promise<void>;
  sendChangeEmailApproval(input: { to: string; newEmail: string; url: string }): Promise<void>;
  sendDeleteAccountConfirmation(input: { to: string; url: string }): Promise<void>;
  sendPasswordChangedNotice(input: { to: string; changedAt: Date }): Promise<void>;
}
```

Templates match the existing invitation/verification style. Emails never contain secrets beyond the single-use link.

### 6.4 Audit

- Migration: add `"user"` to `audit_log_scope`.
- New actions in `audit/actions.ts`: `user.email_changed`, `user.password_changed`, `user.password_reset`, `user.session_revoked`, `user.deleted`.
- Profile and theme changes are **not** audited.
- `user.deleted` is written **before** deletion (same rule as `organization.deleted`), so a failed audit write blocks the delete.
- Read access: the user reads their own user-scoped rows; superadmins read any user's rows. Org admins never see user-scoped rows.

### 6.5 Transfer ownership

`organization.transferOwnership({ organizationId, targetMemberId })` (oRPC):

1. Caller must be an `owner` of the organization.
2. Target must be an existing member who is not the caller.
3. Target's effective R1.1b limit must allow one more owned org.
4. In one DB transaction: set target role to `owner`, set caller role to `admin`.
5. Record `member.role_changed` for both changes.

If the target is already an owner, the procedure only demotes the caller (still guarded by R3.4).

## 7. Requirements

### R1 — Account area

**R1.1 Access** — any signed-in user can open `/account/*`, with or without an active organization.

**R1.2 Entry point** — both user menu variants link to "Account settings".

**R1.3 Profile** — the user can change their display name. The avatar shows initials; there is no upload control.

### R2 — Email change

**R2.1 Approval from old address**

- GIVEN a signed-in user with a verified email
- WHEN they request a change to a new address
- THEN an approval link is sent to the **current** address and the email is unchanged.

**R2.2 Verification of new address** — after approval, a verification link is sent to the new address; the email changes only after it is opened.

**R2.3 Uniqueness** — a change to an address already used by another account fails without revealing which account.

**R2.4 Audit** — a completed change records `user.email_changed` with old and new addresses in metadata.

### R3 — Password

**R3.1 Change password** — a user with a credential password can change it by providing the current one.

**R3.2 Forgot password**

- GIVEN any email address
- WHEN submitted on `/forgot-password`
- THEN the response is identical whether or not an account exists, and a reset link is emailed only if it does.

**R3.3 Reset password** — a valid, unexpired token on `/reset-password` sets a new password; used or expired tokens fail.

**R3.4 Set password for Google-only users** — the Security page shows "Set a password" which triggers the reset email to the user's verified address; completing it creates a credential password.

**R3.5 Side effects** — after a change or reset: all other sessions are revoked, a password-changed notice is emailed, and `user.password_changed` / `user.password_reset` is recorded.

### R4 — Sessions

**R4.1 List** — the user sees their active sessions with device (user agent), IP, last active time, and the current one marked.

**R4.2 Revoke one** — the user can revoke any session except the current one; records `user.session_revoked`.

**R4.3 Revoke others** — "Sign out all other sessions" revokes every session except the current one; records one `user.session_revoked` per session.

### R5 — Preferences

**R5.1 Theme** — `/account/preferences` exposes light/dark/system using the existing theme provider; stored client-side only.

### R6 — Account deletion

**R6.1 Last-owner block**

- GIVEN a user who is the last owner of at least one organization
- WHEN they request account deletion
- THEN it fails and the UI lists those organizations with "transfer ownership or delete the organization first".

**R6.2 Email confirmation** — an eligible request emails a confirmation link; the account is not deleted until it is opened.

**R6.3 Hard delete** — on confirmation the user, sessions, accounts, and memberships are deleted (cascades); audit rows remain with `actorUserId = NULL`.

**R6.4 Audit** — `user.deleted` is recorded before deletion; a failed write aborts the delete.

### R7 — Security log

**R7.1 Self view** — the Security page lists the user's own user-scoped events (newest first, paginated with the shared data table).

**R7.2 Admin view** — `/admin/users/$id` has an "Activity" tab listing that user's user-scoped events; superadmin only.

**R7.3 Isolation** — user-scoped events never appear in any organization's activity page.

### R8 — Transfer ownership

**R8.1 Atomic transfer**

- GIVEN an owner and another member of the same org
- WHEN the owner transfers ownership to that member
- THEN the member becomes `owner` and the caller becomes `admin` in one transaction.

**R8.2 Guards** — fails when the caller is not an owner, the target is not a member, or the target is the caller.

**R8.3 Org limit** — fails when the target has reached their R1.1b limit; nothing changes.

**R8.4 UI** — General danger zone: member picker plus confirmation dialog naming the target.

### R9 — Org limit on promotion

**R9.1** — changing a member's role to `owner` through the existing role-change path fails when the target has reached their R1.1b limit.

### R10 — Leave organization

**R10.1** — any member except the last owner can leave from the General danger zone (R3.5 of `auth-multitenant-rbac.md`); the last owner sees the reason instead of the action.

**R10.2 Landing** — after leaving, the active org switches to the user's next organization; with none, the user lands on `/onboarding`.

### R11 — Delete organization

**R11.1 Permission** — only members with `organization:delete` (owner) see the action.

**R11.2 Confirmation** — the dialog requires typing the exact organization name.

**R11.3 Hard delete** — members, invitations, and custom roles cascade; audit rows remain with `organizationId = NULL`; `organization.deleted` is recorded before deletion (existing behavior).

**R11.4 Landing** — same as R10.2.

## 8. Acceptance criteria

- All R1–R11 scenarios have tests: integration tests against the Postgres test DB for every server rule and guard (R2, R3, R4, R6, R7.3, R8, R9, R10.1, R11.1–R11.3); ordinary checks plus stories for UI.
- New UI components have Storybook stories and pass the story-coverage test.
- Lint-boundary and feature self-import tests pass.
- `docs/architecture/auth.md`, `authorization.md`, `audit-log.md`, and `web-app.md` are updated for the new flows, scope, and routes.

## 9. Tasks (proposed)

**Feature 1: `account-settings`**

1. Email port: four new methods, templates, Resend + console adapters (TDD).
2. better-auth config: `sendResetPassword`, `changeEmail` with old-address approval, `deleteUser` with email confirmation and last-owner `beforeDelete` guard, revoke sessions on password change/reset (TDD).
3. Audit: `user` scope migration, actions, hooks, self/admin read procedures (TDD).
4. Public forgot/reset password pages.
5. Account area layout, user-menu entry, Profile and Preferences pages.
6. Security page: email change, password change / set password, sessions, security log.
7. Danger zone: delete account; admin user Activity tab.

**Feature 2: `org-lifecycle`**

1. Red test proving R9 gap; enforce R1.1b on promotion (TDD).
2. `transferOwnership` procedure with guards and audit (TDD).
3. General danger zone UI: transfer, leave, delete, post-action landing.

## 10. Decisions

1. **Scope** — account + org settings for a B2B multi-tenant starter.
2. **Account v1** — name, change email, change/set password, sessions, delete account, theme. Google link/unlink deferred.
3. **Org v1 additions** — transfer ownership, leave, delete. Existing members/invitations/roles pages unchanged.
4. **Location** — `/account/*` outside `_org`.
5. **Last owner** — blocks account deletion and leaving until ownership is transferred or the org is deleted.
6. **Avatar / logo** — deferred until a storage feature exists; initials fallback.
7. **Forgot password** — included.
8. **Audit** — security events only, in a new `user` scope, visible to the user and superadmins.
9. **Account deletion** — email confirmation link, then hard delete.
10. **Org deletion** — type org name, then hard delete.
11. **Ownership model** — multiple owners remain; R3.4 unchanged.
12. **Transfer** — atomic procedure: target → owner, caller → admin.
13. **Org limit** — enforced on promotion and transfer.
14. **Change email** — old address approves, new address verifies.
15. **Theme** — client-only.
16. **Notifications** — email notice on password change/reset only.
17. **Sessions** — auto-revoke others on password change/reset; "sign out all others" button.
18. **Set password (Google-only)** — via reset email link.
19. **Delivery** — two features, `account-settings` first.
20. **Landing after leave/delete** — next org, else `/onboarding`.
21. **Admin view** — Activity tab on admin user detail.
22. **Checks** — TDD on (`bun test`) for server/auth/API; ordinary checks and stories for UI.

## 11. Open items to verify during implementation

- better-auth 1.7.5 option names and hook shapes for `changeEmail` old-address approval, `deleteUser` verification and `beforeDelete`, `revokeSessionsOnPasswordReset`, and session listing.
- Whether a reset-password flow creates a credential account for Google-only users in 1.7.5, or `setPassword` must be called server-side after token validation.
- Postgres enum migration for `audit_log_scope` with Drizzle (`ALTER TYPE ... ADD VALUE`).
