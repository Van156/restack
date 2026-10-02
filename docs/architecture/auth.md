# Auth

How `packages/auth` configures better-auth. Requirements live in [`docs/specs/auth-multitenant-rbac.md`](../specs/auth-multitenant-rbac.md) and [`docs/specs/dashboard-shell-and-auth-ui.md`](../specs/dashboard-shell-and-auth-ui.md); this page explains the code. For the API side see [authorization.md](./authorization.md).

Code: `packages/auth/src/{index,account-security,platform,org-members,invitation-token,testing}.ts` and `plugins/invitation-sign-up.ts`.

## better-auth setup

`createAuth(env, database, emailSender, auditLogger, options)` in `index.ts` builds the instance. Everything it needs is injected: the Drizzle database, an `EmailSender` port and an `AuditLogger` port.

| Concern                 | Setting                                                                                                                                                   | Spec       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Email and password      | Sign-in refused until the email is verified; verification email on sign-up; auto sign-in after verifying.                                                 | R0.1, R0.2 |
| Google                  | Registered only when both credentials exist; half-configured throws at startup. An unverified Google email fails sign-in.                                 | R5.1, R5.4 |
| Account linking         | Link only when provider and local emails are both verified; `trustedProviders` stays empty, since a trusted provider would link even an unverified email. | R5.4       |
| `user.maxOrganizations` | Extra field, `input: false`: only a superadmin sets it. Unset falls back to `DEFAULT_MAX_ORGS_PER_USER`.                                                  | R6.6       |
| Cookies                 | `sameSite: "none"`, `secure`, `httpOnly`.                                                                                                                 |            |

`CreateAuthOptions.extraPlugins` exists for tests only (for example `testUtils()` to forge sessions). The server never passes it.

## Plugin ordering and hooks

Plugins, in order:

1. `organization`: static roles plus dynamic access control (custom roles, max 25 per organization, R4.8), 48h invitation expiry, and `organizationHooks`.
2. `admin`: platform roles, `defaultRole: "user"`, `adminRoles: ["superadmin"]`, 1h impersonation sessions (R6.4). The duration equals better-auth's default but is set explicitly so it cannot drift upstream.
3. `invitationSignUpPlugin`: the custom `POST /invitation/sign-up` endpoint.
4. `extraPlugins` (tests).

Other hooks:

- `databaseHooks.user.create.before` runs the [invitation email match](#invitation-email-match).
- `hooks.after` is the single better-auth after-hook slot, matched by path. See [Audit hooks](#audit-hooks).

Organization rules enforced in `organizationHooks` and options:

- Only verified users can create organizations (R1.1a).
- `organizationLimit` counts only organizations where the user is `owner`, and returns `true` when the limit is reached (R1.1b). It is best-effort under concurrency: the read-then-decide check can race (spec §8).
- `beforeCreateInvitation` (R2.2): an inviter cannot assign a role whose permissions exceed their own. Custom roles are resolved from `organizationRole`, the same way `hasOrgPermission` does. better-auth's invite route only special-cases the owner role.

## Invitation email match

R5.5: a Google sign-up that carries an invitation id (forwarded through the OAuth round trip as `additionalData`) may only create an account when Google's **verified** email equals the invited email.

- The check runs in `databaseHooks.user.create.before`, before any user row exists. A mismatch leaves no account and never touches the invitation.
- The id is client-supplied and untrusted. It can only make sign-up stricter. Accepting still goes through `acceptInvitation` and its recipient check.
- An unknown, expired or non-pending invitation imposes no restriction.
- `getOAuthState` throws outside a request (scripts, tests), which is treated as "not an OAuth callback".

## Invitation sign-up flow

better-auth has no "sign up and accept" flow: `acceptInvitation` needs an existing session. `plugins/invitation-sign-up.ts` adds it (R2.4).

### Token

The invitation id alone does not prove inbox ownership. When the invitation email is sent, `index.ts` mints a high-entropy token (`invitation-token.ts`), stores only its SHA-256 hash in `verification`, and puts the raw token in the accept link. The endpoint compares hashes in constant time.

On a resend, the email is sent first, then the new hash is inserted, then older rows for that invitation are deleted:

- A failed send leaves the previous link working.
- Inserting before deleting means the "most recent row wins" lookup never sees zero valid rows.

### Request order

`POST /invitation/sign-up` takes the invitation id, token, name and password. It never takes an email.

1. Verify the token first. The existing-account check below would otherwise reveal whether an email is registered. Errors are identical for missing, mismatched and expired tokens.
2. Load the invitation; it must be `pending` and unexpired.
3. Take the email from the invitation, never the request. Reject if an account already exists.
4. Validate password length, then hash it. Hashing has no side effects, so a failure here leaves nothing stuck.
5. Claim the invitation with an atomic guarded update (`pending` to `accepted`). A concurrent accept or cancel loses the race and nothing else runs.
6. Create the user (verified), link the credential account, create the membership.
7. Create the session with the invitation's organization active, and set the cookie.
8. Consume the token and record `invitation.accepted`.

### Failure handling

Every read and write goes through `ctx.context.adapter` or `internalAdapter`. If real transactions are turned on later (`drizzleAdapter(..., { transaction: true })`, currently unset), the handler joins them automatically. Until then the order avoids the two unsafe states:

- Step 6 fails: the claim is reverted to `pending` and any half-created user is deleted, best effort. Compensation failures are logged and never mask the original error, which is rethrown. Result: no accepted invitation without a member, and no verified user without membership.
- Step 7 fails: the user, member and accepted invitation exist without a session. An ordinary sign-in recovers this, so it is not compensated.
- The token is consumed only after full success, so a reverted attempt can be retried.

No verification email is sent: the invitation link already proved inbox ownership.

## Account security flows

Spec: [`docs/specs/account-and-org-settings.md`](../specs/account-and-org-settings.md) R2 to R6. `createAccountSecurity` (`account-security.ts`) returns option fragments for `emailAndPassword` and `user` and a plugin carrying the request hooks; `createAuth` spreads them in. The plugin keeps its own `hooks.before`/`hooks.after`, so the single audit after-hook slot stays free. Mail goes through the `EmailSender` port (`sendResetPassword`, `sendChangeEmailApproval`, `sendDeleteAccountConfirmation`, `sendPasswordChangedNotice`). Option names were checked against better-auth 1.7.5.

| Flow            | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reset password  | `emailAndPassword.sendResetPassword`. `/request-password-reset` answers `{ status: true }` for unknown addresses too (R3.2) and a failed send is caught and logged, so the response stays uniform. The email link validates the token and redirects to `<redirectTo>?token=...` or `?error=INVALID_TOKEN`. `revokeSessionsOnPasswordReset: true`; `onPasswordReset` sends the changed notice and records `user.password_reset`. `/reset-password` creates a credential account when there is none, which is how a Google-only user sets a password (R3.4). |
| Change password | A plugin before-hook on `/change-password` forces `revokeOtherSessions: true` whatever the client sent. An after-hook sends the notice (fire-and-forget) and records `user.password_changed`.                                                                                                                                                                                                                                                                                                                                                              |
| Change email    | `user.changeEmail` with `sendChangeEmailConfirmation`: the approval link goes to the current address, opening it makes better-auth send the usual verification email to the new one, and opening that sets `email` and `emailVerified`. A taken address returns the same `{ status: true }` and sends nothing (R2.3).                                                                                                                                                                                                                                      |
| Delete account  | `user.deleteUser` with `sendDeleteAccountVerification`: `POST /delete-user` only emails a link; `GET /delete-user/callback` deletes the user, signs them out and redirects to `callbackURL` (the web app sends `<origin>/sign-in`). A before-hook on `/delete-user` runs the last-owner guard at request time so a blocked user gets no mail; `beforeDelete` repeats it when the link is opened, then writes `user.deleted`.                                                                                                                               |
| Sessions        | `listSessions`, `revokeSession`, `revokeOtherSessions` and `revokeSessions` are better-auth's own. A before-hook rejects revoking the current session (`400 CANNOT_REVOKE_CURRENT_SESSION`, R4.2); a foreign token is ignored.                                                                                                                                                                                                                                                                                                                             |

Last-owner block (R6.1): `assertNotLastOwner` throws a `409` whose body carries `code: "USER_IS_LAST_OWNER"` and `organizations: [{ id, name }]`; the client error is flat, so the web app reads `error.organizations`. The guard is not atomic with the delete, and the pre-delete audit write is a separate statement (see the comment on `beforeDelete`).

Audit seams: `createAuth(..., { accountSecurityEvents })` takes optional callbacks that default to `createUserAuditEvents(auditLogger)`; see [audit-log.md](./audit-log.md#user-scope).

## Audit hooks

Audit writes (R7.1, R7.2) come from two places, both calling `AuditLogger.record`:

- `organizationHooks` in `index.ts` for native organization events.
- `createAuditAfterHook` (`audit/`) for actions with no native hook: dynamic roles, `/organization/leave` and every admin-plugin action. better-auth has one `hooks.after` slot, so a single hook dispatches by path.

Rules:

- Actor, impersonator and network context come from the request's own session through `resolveAuditActor`, never from a hook payload field, whose meaning differs per hook. The payload's own subject is only a fallback when the request has no session (for example the server-only `/organization/add-member`).
- `beforeDeleteOrganization` writes before the delete. Once the organization is gone, `audit_log.organization_id` (`ON DELETE SET NULL`) is nulled, so the `organizationName` snapshot keeps the entry readable. A failed audit write also blocks the deletion.
- `afterAddMember` does not fire for invitation acceptance (better-auth creates the member directly). `afterAcceptInvitation` records `invitation.accepted`, so one acceptance yields one entry.
- `invitation-sign-up.ts` has no native hook, so it records `invitation.accepted` directly. Both acceptance paths log exactly once.
- In `afterRemoveMember`, `user` is the removed member, not the caller.
- In `afterUpdateOrganization`, `organization` can be null when the adapter returns no row; the member row always has the id.

## Platform lists

`platform.ts` and `org-members.ts` back the admin and members tables with Drizzle queries over the shared list input (`@base-template/db/lib/list-query`). Column ids are defined by the list contracts in `@base-template/api` (`*ListConfig`).

Common rules:

- `*_LIST_COLUMNS` maps list-input ids to table columns. It is the only way a client-supplied id reaches SQL.
- Ties break by `id`, so a page boundary is stable. `total` is an exact `count(*)`.
- A database failure rejects, so the UI can show an error instead of an empty page. This is why `listPlatformUsers` replaces better-auth's `list-users`, which swallows query errors.
- Callers must gate each function: `listPlatformUsers` behind `user:list`, `listPlatformOrganizations` behind `organization:list`. The functions apply no permission check themselves.

Specifics:

- **Organizations**: no better-auth endpoint lists every tenant (`listOrganizations` is scoped to the caller's memberships), so it queries `organization` and `member` directly. The member count is an aggregate over a left join, so it is shown but not sortable or filterable.
- **Users**: `role` and `status` are derived filters handled in `userFilterCondition`. `role` is a comma-separated list, so `eq` means "has this role" and `inArray` means "has any of these". `status` comes from `banned`, with NULL counted as active, so the two statuses partition every row. For both, an empty `inArray` list matches no row and an empty `notInArray` list restricts nothing; status values other than `active`/`banned` are rejected. Status truth table: `banned` only → `banned IS TRUE`; `active` only → `NOT (banned IS TRUE)`; both → every row; neither → no row. An unsupported operator or value shape throws `UnsupportedFilterError` (the router maps it to `BAD_REQUEST`). Text search is case-insensitive.
- **Members**: `listOrganizationMembers` always ANDs `organizationId` with the filters, so no filter combination reaches another tenant's members. Pass the session org id (`context.org.id`), never a client value (R5.1). It replaces `listMembers`, which can only sort and filter on `member` fields.

## Test harness

`testing.ts` is exported as `@base-template/auth/testing` and used only by `*.integration.test.ts` files in auth and api. Production code never imports it.

- `RecordingEmailSender` and `RecordingAuditLogger` record calls in memory. `failNextInvitation` makes the next send reject, to test resends without DB changes.
- `signUpAndVerify` signs up, follows the captured verification link and returns authenticated headers.
- `cookieHeaderFromSetCookie` rebuilds a `Cookie` header from `set-cookie`. `Headers.get("set-cookie")` comma-joins entries, and `/admin/impersonate-user` sets five cookies, clearing some first. Taking the first pair would pick a cleared cookie and fail authentication. The helper uses better-auth's `splitSetCookieHeader`, keeps the last value per name and drops cleared cookies.
- `truncateAllTables` derives the table list from the db schema at call time, so new tables are never missed. It refuses to run unless the database name ends with the test suffix.
- `resolveTestDatabaseUrl` is re-exported from `@base-template/db/testing`.
- `@base-template/db/testing` owns the database side: the default test URL (port 5436, database name ending in `_test`, never the dev database), `requireTestDatabaseOrSkip` (throws in CI when the database is unreachable, warns and skips locally) and `isDatabaseReachable` (never throws, bounded connect timeout). `DATABASE_URL` is ignored on purpose so an app `.env` cannot redirect tests to a real database.
