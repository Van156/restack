# Feature: Organization Lifecycle

- **Spec:** `docs/specs/account-and-org-settings.md` §6.5, §7 R8–R11 (source of truth; decisions §10)
- **Tracker branch:** `feat/org-lifecycle`, created from `feat/account-settings` (`3f193c5`) before that branch merged (user-authorized 2026-10-02).
- **Delivery:** strategy `ask-on-risk` → chain strategy `feature-branch-chain` (project convention): one slice branch per task `feat/org-lifecycle-NN-<name>`, fast-forwarded into the tracker.
- **TDD:** on for server/auth/API — source: spec §10 decision 22 — runner: `bun test`. UI uses ordinary checks plus stories.
- **Review (RDD):** on (global); user policy: review every two tasks, auto-consent. Groups: T1+T2, then T3 alone. First boundary: `3f193c5`.
- **Forecast:** ~1,200–1,600 authored changed lines → 3 slices.

## Objective

Transfer ownership, leave, and delete an organization from the org settings General page, and enforce the R1.1b org limit when a member is promoted to owner.

## Constraints

- better-auth 1.7.5: verify hook names and shapes against `node_modules/better-auth/dist` before use.
- `packages/api` does not import better-auth directly (structural ports in `authorization.ts`).
- `packages/ui` stays app-agnostic; `shared/**` never imports features; route files stay thin.
- New presentational components get stories and an entry in `tests/lib/app-story-registry.ts`.
- Conventional commits, no AI attribution. Run `pnpm oxfmt --write` before committing so lefthook is a no-op.

## Exploration summary (2026-10-02)

- Org limit lives only in the `organizationLimit` callback (`packages/auth/src/index.ts`); `countOwnedOrganizations` is module-private. Promotion to owner is unchecked (no `beforeUpdateMemberRole` hook); R3.4 last-owner protection is built into better-auth.
- No oRPC organization router; `orgProcedure` + `requirePermission` in `packages/api/src/index.ts`; Context has `db` and `defaultMaxOrganizationsPerUser` but no audit logger.
- `member.role_changed` is written by `afterUpdateMemberRole`; a direct DB transfer bypasses it, so the procedure writes both rows.
- Leave (`leaveOrganization`, `member.left`) and delete (`deleteOrganization`, `organization.deleted` before delete) already work server-side; web `leaveMutation` navigates to `/dashboard`.
- General page is gated by `CanGate organization:update`; leave must reach plain members, so gating moves per section. `ConfirmDialog` has no typed-name input.

## Tasks

- [x] **T1 — R9 org limit on promotion** (TDD): RED integration test proving a promotion to `owner` past the R1.1b limit succeeds today; extract an exported org-limit helper (owned count + effective limit) reused by `organizationLimit`; add `beforeUpdateMemberRole` that rejects promotion to owner when the target is at the limit (nothing changes); test that demotion/other roles and already-owners are unaffected. Route: delegated (writer; auth hook + helper + tests).
- [x] **T2 — `organization.transferOwnership`** (TDD): oRPC procedure per spec §6.5 — caller owner, target member ≠ caller, target limit (T1 helper), one transaction (target → owner, caller → admin; already-owner target only demotes the caller), two `member.role_changed` rows; audit logger exposed to the API context through a port. Integration tests for R8.1–R8.3. Route: delegated (writer; api router + context wiring + tests).
- [x] **T3 — General danger zone UI**: Follow-ups from T1+T2 review first (server; delegated general writer, own commit): (a) `organization.ts:89-97`/`64-76` the limit check and its already-owner skip run before the row lock — re-evaluate target role and limit under the lock; (b) `organization.ts:10-11` duplicated `TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS` literal — share one constant with `packages/auth/src/org-limit.ts`; (c) `auth.integration.test.ts:234-253` rejection tests assert only that it rejects — assert the error code; (d) `auth.integration.test.ts:230` test mutates shared config — isolate; (e) `organization.integration.test.ts:23-28` stale docblock and unused fixture org D (`:201`); `project.test.ts:31` stub comment; (f) document that audit rows are written after commit (a failed write returns an error although roles changed) and add tests for the CONFLICT path and audit-write failure. Then UI: per-section gating; transfer (member picker + confirmation naming the target, R8.4); leave (any member, last owner sees the reason, R10.1); delete (owner only, typed exact name, R11.1–R11.2); landing after leave/delete = next org or `/onboarding` (pure decision + test, R10.2/R11.4); stories; docs (`authorization.md`, `audit-log.md`, `web-app.md`). Route: delegated (`react-staff`).
- [x] **T4 — T3 review follow-ups** (authorized 2026-10-02): (a)–(f) from "Follow-ups from T3 review". Route: delegated — server part (e) + server readability items (general writer, TDD for (e)), then web part (a)–(d) + web readability items (`react-staff`). Branch `feat/org-lifecycle-04-review-followups`. Reviewed alone from base 91bbb98.

## Checks (every slice)

Node 26 (`nvm use`): `pnpm check-types`, `pnpm lint`, `bun test` (needs `base-template-postgres` via colima), `pnpm build`, `pnpm build-storybook` (UI slices).

## Progress

| Task | Branch                                   | Commit(s)                                        | Checks                                                                                                                                                                                                                                                                                                                                      | Review                                                                                                                                                                                                     |
| ---- | ---------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | feat/org-lifecycle-01-promotion-limit    | b6439af                                          | RED: 2 of 6 new tests failed (promotion past limit, string + array role, resolved instead of rejecting); Node 26: check-types ok; lint ok; bun test 1214 pass/0 fail/0 skip; pnpm build ok; parent re-ran auth.integration 11 pass/0 fail                                                                                                   | same group                                                                                                                                                                                                 |
| T2   | feat/org-lifecycle-02-transfer-ownership | 133e0d4                                          | RED: test file failed `Cannot find module './organization'`; GREEN 10/10; Node 26: check-types ok; lint ok; bun test 1224 pass/0 fail/0 skip; pnpm build ok; parent re-ran organization.integration 10 pass/0 fail                                                                                                                          | T1+T2 group, range 3f193c5..133e0d4 high (714 lines, 15 files), auto-consent, 4-lens approved + acknowledged (review-3b490405b84abe5d); 6 warnings + 4 suggestions, none blocking → T3 follow-ups (a–f)    |
| T3   | feat/org-lifecycle-03-danger-zone        | 5a9aa55 (T1+T2 follow-ups a–f), 7e0d914, 91bbb98 | a: RED lock-time limit test failed (12 pass/1 fail) → 13/13; f GREEN-first (documents existing behavior); Node 26: check-types ok; lint ok; bun test 1246 pass/0 fail/0 skip; pnpm build ok; build-storybook ok; parent re-ran api+auth integration 24 pass/0 fail and web organizations+shared 421 pass/0 fail; real-browser smoke NOT run | T3 alone, range 133e0d4..91bbb98 high (955 lines, 25 files), auto-consent, 4-lens approved + acknowledged (review-e99c8550547a607b); 8 warnings + 5 suggestions, none blocking → follow-ups below          |
| T4   | feat/org-lifecycle-04-review-followups   | 7033566 (server), d656c48 (web)                  | e: RED lock test (transfer settled while target row locked; 13 pass/1 fail) → 14/14; Node 26: check-types ok; lint ok; bun test 1256 pass/0 fail; pnpm build ok; build-storybook ok; parent re-ran check-types ok + full bun test 1256 pass/0 fail; real-browser smoke NOT run                                                              | T4 alone, range 91bbb98..d656c48 high (595 lines, 25 files), auto-consent, 4-lens approved + acknowledged (review-a307e6c1c8f7a028); 1 warning + 8 suggestions, none blocking → remaining follow-ups below |

## T1 decision record

- `organizationHooks.beforeUpdateMemberRole({ member, newRole, user, organization })` (verified in better-auth 1.7.5 `crud-members.mjs`): runs after permission/role validation, before the update; `newRole` is a comma-joined string; `member.role` is the previous role; `user` is the target.
- Rejects with `APIError("FORBIDDEN", { code: "TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS" })` only when the new role adds `owner` and the target is at the limit (better-auth's own code reads as the caller's limit, so a project code is used).
- Helper `hasReachedOwnedOrgLimit(database, userId, defaultLimit)` + `countOwnedOrganizations` in `packages/auth/src/org-limit.ts` (drizzle + schema only); import via `@base-template/auth/org-limit` to avoid pulling better-auth into `packages/api`.

## T2 decision record

- `organization.transferOwnership({ organizationId, targetMemberId })` on `orgProcedure`; `organizationId` must equal the session's active org (`BAD_REQUEST` otherwise). Returns `{ organizationId, newOwnerMemberId }`; `targetMemberId` is `member.id`.
- Roles set exactly (`owner` / `admin`); one transaction with `FOR UPDATE` on both member rows, caller owner role re-checked under lock (`CONFLICT`).
- Errors: `FORBIDDEN` (caller not owner), `BAD_REQUEST` (org mismatch, self), `NOT_FOUND` (target missing / other org), `TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS` (403), `NO_ACTIVE_ORGANIZATION` (409), `CONFLICT`.
- Audit: `Context.auditLogger` (type-only `AuditLogger` from `@base-template/auth/audit`), wired in `apps/server/src/context.ts`; two `member.role_changed` rows written after commit, failure fails the request; rows carry no ip/userAgent.

## T3 decision record

- `CanGate organization:update` wraps only the rename/slug form; the danger zone renders for every member. Leave: everyone (last owner sees the reason, computed from the member directory — UX only). Transfer: owner role (`hasOwnerRole` on `useActiveMemberRole`). Delete: `useCan("organization:delete")`.
- `ConfirmDialog` gained optional `confirmationPhrase` (exact, case-sensitive, untrimmed match via `matchesConfirmationPhrase`).
- Landing: `decideOrgLanding` + `useOrgLanding` drop the exited org, `setActive(first)` → `/dashboard`, none → `/onboarding`; list/setActive failures toast and go to `/dashboard`.
- `transferOwnershipErrorMessage` maps the T2 error codes to copy; success invalidates members, member directory, active role and `can` queries.

## Follow-ups from T3 review (authorized as T4)

- (a) `use-member-mutations.ts:71-73` members-page leave does not navigate when the landing is undefined.
- (b) `use-org-lifecycle-mutations.ts:54-57` a landing failure after a successful delete is reported as a delete failure.
- (c) `use-org-lifecycle-mutations.ts:26-28` transfer partial failure (audit write fails after commit) leaves stale UI — invalidate on error too.
- (d) `org-danger-zone-section.tsx:22-33` behavior while the session is pending; `:34-37` danger zone silent when the member directory query errors.
- (e) `organization.ts:99-110` the limit re-check is not serialized across orgs (two concurrent transfers to the same target in different orgs can both pass).
- (f) Readability: duplicated leave mutation (`use-org-lifecycle-mutations.ts:31-45`), duplicated query keys (`use-org-landing.ts:21-23`), literal error code in web (`org-danger-zone.ts:46`), redundant alias (`organization.ts:14`), hard-coded `afterEach` default (`auth.integration.test.ts:70-73`), ConfirmDialog phrase wiring untested.

## T4 decision record

- Transfer takes `SELECT id FROM "user" WHERE id = target FOR UPDATE` first in the transaction (before member rows) to serialize the limit re-check per target user; covers transfer-vs-transfer only — better-auth org create and `beforeUpdateMemberRole` do not take it.
- Web: one exit hook (`use-org-exit-mutation.ts`) for leave/delete always lands; landing failure after a successful exit has its own toast; transfer invalidates org-scoped roots `onSettled`; `dangerZoneView` (pure) drives skeleton / directory-error-with-retry (transfer and leave withheld) / ready; query keys centralized (`access-control/lib/query-keys.ts`, `organizations/lib/org-query-keys.ts`); web-side copy of the limit error code (server module is not browser-safe). Role changes now also refresh the member directory.

## Remaining follow-ups from T4 review (not scheduled)

- WARNING `use-org-exit-mutation.ts:28-35` exit landing path untested at hook level (no DOM test setup; logic in `decideOrgLanding`/`org-exit.ts` is unit-tested).
- Suggestions: mixed org-id source in `use-org-lifecycle-mutations.ts:34-35`; orphaned docblock `organization.ts:15`; split describe block `org-danger-zone.test.ts:122-128`; timing-based lock assertion (500 ms) in `organization.integration.test.ts:281-286`; session-null last-owner case `org-danger-zone-section.tsx:23`; lock scope notes `organization.ts:84-94`; transfer `onSettled` untested.

## Next step

Feature complete (T1–T4 reviewed; boundary d656c48). Push/PR/merge of `feat/account-settings` and `feat/org-lifecycle` are the user's decisions.
