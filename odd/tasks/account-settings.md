# Feature: Account Settings

- **Spec:** `docs/specs/account-and-org-settings.md` §7 R1–R7 (source of truth; decisions §10), committed in `9acb243`
- **Tracker branch:** `feat/account-settings`, created from `main` (`9acb243`)
- **Delivery:** strategy `ask-on-risk` → chain strategy `feature-branch-chain` (project convention): one slice branch per task `feat/account-settings-NN-<name>`, fast-forwarded into the tracker.
- **TDD:** on for server/auth/API — source: spec §10 decision 22 — runner: `bun test`. UI uses ordinary checks plus stories.
- **Review (RDD):** on (global); user policy: review every two tasks, auto-consent.
- **Forecast:** ~3,000–4,000 authored changed lines → 7 slices
- **Follow-up feature:** `org-lifecycle` (spec R8–R11) starts after this one merges.

## Objective

Personal `/account/*` area (profile, security, preferences, danger zone), forgot/reset password, user-scoped security audit log with self and admin views.

## Constraints

- better-auth 1.7.5: verify option names against installed source (`node_modules/better-auth/dist`) before use (spec §11).
- `packages/ui` stays app-agnostic; `shared/**` never imports features; route files stay thin.
- New presentational components get stories and an entry in `tests/lib/app-story-registry.ts`.
- Conventional commits, no AI attribution. Formatters before commit so lefthook hooks are no-ops.
- Do not commit the user's untracked/uncommitted files (`Makefile` is tracked now; leave unrelated edits alone).

## Tasks

- [x] **T1 — Email port**: `sendResetPassword`, `sendChangeEmailApproval`, `sendDeleteAccountConfirmation`, `sendPasswordChangedNotice`; templates; Resend + console adapters (TDD). Route: delegated (writer, 2+ files).
- [x] **T2 — better-auth config**: `sendResetPassword`, `changeEmail` (old-address approval → new-address verification), `deleteUser` (email confirmation + last-owner `beforeDelete` guard), revoke other sessions + notice on password change/reset; Google-only set-password via reset (TDD, integration). Route: delegated.
- [x] **T3 — User audit scope**: `audit_log_scope` + `user` migration, actions, hooks (email changed, password changed/reset, session revoked, deleted-before-delete), self/admin read procedures, R7.3 isolation (TDD). Route: delegated. Follow-ups from T1+T2 review first: (a) `/request-password-reset` with an email-send failure for an existing account returns an error while an unknown address returns success — catch/log the send so the R3.2 response stays uniform (and do not block the response on the password-changed notice, R4 latency); (b) the failing-notice test under-asserts (assert revocation and the endpoint still succeed); (c) remove the unused password select in `account-security.integration.test.ts:223`; (d) document the last-owner check / delete TOCTOU (guard re-runs in `beforeDelete`; not atomic with the delete) and that the pre-delete audit write is not in the delete transaction.
- [x] **T4 — Forgot/reset password pages** (`_public-auth`). Route: delegated (`react-staff`).
- [x] **T5 — Account area**: layout + SectionNav, user-menu entry (both variants), Profile, Preferences. Route: delegated (`react-staff`). Follow-ups from T3+T4 review first: (a) `reset-password-form.tsx:33-46` maps every HTTP error to the invalid-link state — only `INVALID_TOKEN`/400 token errors should; 429/5xx stay inline and retryable (extract the classification as a pure function + test); (b) story copy drift in `auth-status-notice.stories.tsx:38` (match real copy); (c) `audit.integration.test.ts:399-407` smuggled-userId test is ambiguous — assert the extra key is stripped/rejected explicitly; (d) `user-events.ts:41-51` session_revoked writes are per-row best-effort, a mid-loop failure leaves a partial trail — document or write in one batch.
- [x] **T6 — Security page**: email change, change/set password, sessions (list, revoke, revoke others), security log table. Route: delegated (`react-staff`). Also: a user with no active organization sees org-scoped sidebar links (Dashboard, Organization) that bounce to `/onboarding` and an empty org switcher — hide org-scoped nav groups when there is no active organization.
- [x] **T7 — Danger zone + admin Activity tab**; docs (`auth.md`, `authorization.md`, `audit-log.md`, `web-app.md`). Route: delegated (`react-staff`). Follow-ups from T5+T6 review first: (a) `use-nav-context.ts:9-16` hides org nav when the org list query errors — treat error like loading (keep links); (b) `password-section.tsx:30-35` sessions list is stale after a password change revokes others — invalidate the sessions and `audit.listSelf` queries; (c) `sessions-section.tsx:68-81` revoke flow untested — extract the revoke-outcome handling into a pure function + test; (d) `security-schemas.test.ts:18-23` test name/trim mismatch; (e) `profile-schema.ts:3-6` name rule duplicates sign-up — share one rule.

## Checks (every slice)

Node 26 (`nvm use`): `pnpm check-types`, `pnpm lint`, `bun test` (needs `base-template-postgres`), `pnpm build`, `pnpm build-storybook` (UI slices).

## Progress

| Task | Branch                                  | Commit(s)                                                 | Checks                                                                                                                                                                                                                                                                                                                                                                     | Review                                                                                                                                                                                                   |
| ---- | --------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | feat/account-settings-01-email-port     | 2b73a83                                                   | RED: 9 failures (`sendX` is not a function); `bun test src/email` 25 pass/0 fail                                                                                                                                                                                                                                                                                           | T1+T2 group, range 9acb243..7b20375 high (1132 lines, 11 files), auto-consent, 4-lens approved + acknowledged (review-eeaacd4abc55e3cc); 7 warnings + 3 suggestions, none blocking → T3 follow-ups (a–d) |
| T2   | feat/account-settings-02-auth-config    | 7b20375                                                   | RED: 13 of 16 integration tests failed (reset/change-email disabled, current-session revoke allowed, delete not blocked); GREEN 16/16; Node 26: check-types ok; lint ok; bun test 1115 pass/0 fail (125 files); pnpm build ok; parent re-ran account-security + email tests 41 pass/0 fail                                                                                 | same group                                                                                                                                                                                               |
| T3   | feat/account-settings-03-user-audit     | 819ebe1                                                   | Follow-ups a–d included (a: better-auth already swallowed send errors — regression guard + explicit catch; notice now fire-and-forget). RED: 8 user-audit integration, 4 notice timeouts, 5 API (missing procedures); Node 26: check-types ok; lint ok; bun test 1137 pass/0 fail (126 files); pnpm build ok; parent re-ran user-audit + audit router tests 23 pass/0 fail | pending (T3+T4 group, base 7b20375)                                                                                                                                                                      |
| T4   | feat/account-settings-04-password-pages | fdf51ae                                                   | Node 26: check-types ok; lint ok; bun test 1145 pass/0 fail (127 files); pnpm build ok; build-storybook ok; parent re-ran `apps/web/src/features/auth` 53 pass/0 fail; real-browser smoke NOT run                                                                                                                                                                          | T3+T4 group, range 7b20375..fdf51ae high (3098 lines, 34 files), auto-consent, 4-lens approved + acknowledged (review-10162d89e5a969ea); 3 warnings + 4 suggestions, none blocking → T5 follow-ups (a–d) |
| T5   | feat/account-settings-05-account-area   | ec95b46 (T3+T4 follow-ups a–d), 06b70ff                   | RED for `isInvalidResetTokenError` (missing module) → 4 pass; Node 26: check-types ok; lint ok; bun test 1156 pass/0 fail (130 files); pnpm build ok; build-storybook ok; parent re-ran check-types ok + full bun test 1156 pass/0 fail; real-browser smoke NOT run                                                                                                        | pending (T5+T6 group, base fdf51ae)                                                                                                                                                                      |
| T6   | feat/account-settings-06-security       | e3f961a, 2b365f2, a6ec5e1, cd8cbab                        | Pure logic with unit tests (not strict RED-first); Node 26: check-types ok; lint ok; bun test 1196 pass/0 fail (135 files); pnpm build ok; build-storybook ok; parent re-ran account/app/audit-log web tests 78 pass/0 fail; real-browser smoke NOT run                                                                                                                    | T5+T6 group, range fdf51ae..cd8cbab high (2149 lines, 62 files), auto-consent, 4-lens approved + acknowledged (review-2008a67e9fc3253e); 4 warnings + 5 suggestions, none blocking → T7 follow-ups (a–e) |
| T7   | feat/account-settings-07-danger-admin   | 0f9fbfc (T5+T6 follow-ups a–e), 66f992b, 62f5cb8, 7358400 | Node 26 (re-run 2026-10-02 at closure): check-types ok; lint ok; bun test 1208 pass/0 fail (137 files); pnpm build ok; build-storybook ok; real-browser smoke NOT run                                                                                                                                                                                                      | T7 alone (odd final task), range cd8cbab..7358400, approved + acknowledged (review-b90eced85468308b); findings not recorded in this doc                                                                  |

## T2 decision record (verified against better-auth 1.7.5 source)

- **Reset:** `emailAndPassword.sendResetPassword({user,url,token})`; email `url` is `${baseURL}/reset-password/${token}?callbackURL=<redirectTo>`, which validates and redirects to `redirectTo?token=…` or `?error=INVALID_TOKEN`. T4 passes `redirectTo = <appUrl>/reset-password` (trusted origin). Same `{status:true}` for unknown emails (no mail sent). `revokeSessionsOnPasswordReset: true`; `onPasswordReset` runs before revocation, so audit/notice seams are best-effort (caught). Token single-use.
- **R3.4:** native — `/reset-password` creates a `credential` account when none exists (Google-only user). Does not mark email verified.
- **Change email:** `user.changeEmail.enabled` + `sendChangeEmailConfirmation({user,newEmail,url,token})` = old-address approval; opening it sends the existing verification email to the new address; opening that sets `email`, `emailVerified=true`. Taken address → identical `{status:true}`, nothing sent (R2.3). Known edge: address taken between approval and verification → unique-constraint 500.
- **Delete:** `user.deleteUser` with `sendDeleteAccountVerification`; actual delete at `GET /delete-user/callback?token=` (same user session) which runs `beforeDelete`. A plugin before-hook on `/delete-user` runs the R6.1 guard at request time (no mail to blocked users); `beforeDelete` repeats it, then calls `userDeleting` (throw aborts, R6.4). Error: 409 `{ code: "USER_IS_LAST_OWNER", message, organizations: [{id,name}] }` on `error.body` and in handler JSON. Cascades confirmed (session, account, member, invitation); audit FKs `set null`.
- **Change password:** before-hook forces `revokeOtherSessions: true`; after-hook (reads `returned.user`) sends the notice and calls `passwordChanged`.
- **Sessions:** `listSessions`, `revokeSession({token})`, `revokeOtherSessions`, `revokeSessions`. Before-hook rejects revoking the current session (400 `CANNOT_REVOKE_CURRENT_SESSION`); other users' tokens are silently ignored.
- **Seams for T3:** `createAuth(..., { accountSecurityEvents })`: `passwordChanged`, `passwordReset` (after, best-effort), `userDeleting` (before, rejection aborts). Not wired: `email_changed` (use `emailVerification.afterEmailVerification` or `databaseHooks.user.update`) and `session_revoked` (hook the revoke paths; capture sessions in a before-hook).

## T3 decision record

- Migration `20261001224937_gifted_justin_hammer`: `ALTER TYPE "audit_log_scope" ADD VALUE 'user'`.
- `email_changed`: `databaseHooks.user.update.after` only when `ctx.path === "/verify-email"` and token `requestType` is `change-email-verification`; metadata `{actorEmail, oldEmail, newEmail}`. Sign-up verification records nothing.
- `session_revoked`: before-hook on the three revoke paths captures the caller's sessions (WeakMap keyed by `ctx.context`), after-hook writes one row per revoked session on success; metadata `sessionId`, `sessionUserAgent`, `sessionIp`, `sessionCreatedAt` (never the token). Auto-revocations from password change/reset are not session rows; password rows carry `otherSessionsRevoked`/`allSessionsRevoked`.
- Failure policy: all user events best-effort except `user.deleted` (aborts). `createAuth` defaults `accountSecurityEvents` to `createUserAuditEvents(auditLogger)`.
- Reads match `target_id` (survives user deletion). Platform activity list excludes `scope = "user"`. Procedures: `audit.listSelf` (protected; shared list input; sort `createdAt`/`action`; filters `createdAt` date, `action` select over `USER_LOG_ACTIONS`) and `audit.listUser` (superadmin, `+ { userId }`); both return `{ rows, total }`. Config `userAuditListConfig` in `packages/api/src/lib/audit-list-config.ts`.
- Known gaps: notice fire-and-forget assumes a long-lived server; reset send still awaited (timing difference known/unknown); impersonator capture on user rows best-effort, untested.

## T5 decision record

- `/account` sits under `_auth` (not `_org`), opts into the app shell via `staticData: { appShell: true }`; `/account` index redirects to `/account/profile`.
- Nav: `account` group ("Personal" → "Account settings") in `navGroups`; `SectionNav` uses `getSectionItems("account")`. Security added in T6; T7 adds Danger zone in `apps/web/src/app/navigation.ts`.
- Profile: `authClient.updateUser({ name })` (client refreshes the session atom on `/update-user`); name trimmed, min 2. Initials avatar via `getInitials`. Email read-only.
- Preferences: radio group over `useTheme`; nothing persisted beyond the provider.
- User menu: "Account settings" in both variants (`extraItems` in sidebar).
- reset form: only `INVALID_TOKEN` switches to the invalid-link state (`isInvalidResetTokenError`).

## T6 decision record

- Org-scoped nav groups hide only when the user has no organizations at all (`hasOrganization` = active org, any membership, or list loading); Platform stays for superadmins.
- Password section switches on `listAccounts()` `credential` providerId: change form vs "Set a password" (reset link). `INVALID_PASSWORD` → inline message.
- Change email `callbackURL = <origin>/account/security`; identical notice whether or not the address is taken.
- Sessions: current matched by `session.session.id`, listed first, no revoke button; shared `ConfirmDialog`; revoke refetches sessions + `audit.listSelf`. "Last active" = session `updatedAt` (may lag).
- Security log lives in `features/audit-log` as `SelfSecurityLog` (table generic over row type) so T7's admin tab reuses it.

## Next step

Feature complete (T1–T7, all groups reviewed; boundary 7358400). Next: the `org-lifecycle` feature (spec R8–R11), continued on top of this tracker branch as authorized by the user on 2026-10-02.
