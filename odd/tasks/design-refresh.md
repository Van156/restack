# Feature: Design Refresh (institutional identity)

- **Source:** grilling session + approved design plan, 2026-10-02 (Engram `design/refresh-grill`).
- **Tracker branch:** `feat/design-refresh` from `main` (`d7d844e`).
- **Delivery:** strategy `ask-on-risk` → chain strategy `feature-branch-chain` (project convention): one slice branch per task `feat/design-refresh-NN-<name>`, fast-forwarded into the tracker.
- **TDD:** off for this feature (visual work) — source: project convention (TDD on only for server/auth/API). Runner for ordinary checks: `bun test`. UI uses ordinary checks plus stories.
- **Review (RDD):** on (global); user policy: review every two tasks, auto-consent. Groups: T1+T2, T3+T4, T5 alone. First boundary: `d7d844e`.
- **Forecast:** ~900–1,300 authored changed lines → 5 slices.

## Objective

Replace the stock shadcn neutral look with a sober institutional identity for a reusable B2B SaaS base: graphite neutrals, petrol accent, IBM Plex, small hierarchical radii, compact density, ink sidebar in both modes, and a central brand config.

## Approved design plan

### Color (`--brand-hue: 220` drives accent and neutral tint)

| Token                     | Light                                                | Dark                                                |
| ------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| background                | `oklch(0.985 0.003 220)`                             | `oklch(0.17 0.010 225)`                             |
| card                      | `oklch(1 0 0)`                                       | `oklch(0.205 0.012 225)`                            |
| popover                   | `oklch(1 0 0)`                                       | `oklch(0.23 0.013 225)`                             |
| foreground (ink)          | `oklch(0.21 0.012 225)`                              | `oklch(0.95 0.005 220)`                             |
| primary (petrol)          | `oklch(0.45 0.08 220)` / fg `oklch(0.985 0.003 220)` | `oklch(0.70 0.09 212)` / fg `oklch(0.17 0.010 225)` |
| secondary, muted          | `oklch(0.955 0.006 220)`                             | `oklch(0.26 0.012 225)`                             |
| muted-foreground          | `oklch(0.50 0.015 225)`                              | `oklch(0.70 0.012 220)`                             |
| accent (hover)            | `oklch(0.94 0.012 220)`                              | `oklch(0.30 0.015 225)`                             |
| border / input            | `oklch(0.90 0.006 220)` / `oklch(0.86 0.008 220)`    | `oklch(0.30 0.012 225)` / `oklch(0.34 0.012 225)`   |
| ring                      | = primary                                            | = primary                                           |
| sidebar (ink, both modes) | `oklch(0.22 0.015 225)`                              | `oklch(0.135 0.010 225)`                            |
| success                   | `oklch(0.52 0.12 150)`                               | `oklch(0.72 0.13 150)`                              |
| warning                   | `oklch(0.70 0.14 75)` (ink fg)                       | `oklch(0.80 0.13 80)`                               |
| info                      | `oklch(0.52 0.10 255)`                               | `oklch(0.72 0.10 255)`                              |
| destructive               | `oklch(0.53 0.19 27)`                                | `oklch(0.68 0.17 25)`                               |

Charts: categorical — petrol 220, ochre 75, plum 330, sage 145, indigo 275; validate with the `dataviz` skill (colorblind-safe, both modes).

### Type

IBM Plex Sans (variable if available) for all UI; IBM Plex Mono 400/500 only for IDs, tokens, code. Scale: 12 badges/meta · 13 table cells/nav · 14 body/forms · 16 section titles (600) · 20 page title (600) · 28 auth title (600). `tabular-nums` in tables/dates; headings tracking `-0.01em`. No all-caps labels, no eyebrows, no decorative mono.

### Shape and density

Fixed radius scale: `sm` 2px, `md` 4px, `xl` 6px (buttons/inputs/popovers `rounded-md` → 4px; cards/dialogs `rounded-xl` → 6px). Badge: rectangular 2px tag. Buttons/inputs default `h-8`; auth uses `size="lg"`. Table rows ~34px, 13px text. Cards: border only, no shadow; shadows only on popovers/dialogs.

### Layout

- Shell: ink sidebar in both modes; active item = 2px petrol bar + slightly lighter surface (no filled pill); header 48px with bottom border; page title 20px left-aligned.
- Auth: ink brand panel (same material as sidebar) with logo, name, one tagline, legal footer; no gradient. Mobile: panel collapses to an ink strip with the logo.
- Brand config: `apps/web/src/app/brand.ts` (name, tagline, logo path), read by `vite.config.ts` (PWA name, `theme_color`); `--brand-hue` in `globals.css`.
- Home `/`: redirect — session → dashboard, otherwise sign-in.
- Theme default: system. Motion: functional transitions only, respect `prefers-reduced-motion`.

## Constraints

- shadcn `base-vega` stays the component base; customize, do not rewrite.
- `packages/ui` stays app-agnostic; `shared/**` never imports features; route files stay thin.
- Light and dark both first-class; WCAG AA for text pairs.
- Changed presentational components keep their stories working; new variants get stories.
- Conventional commits, no AI attribution. Run `pnpm oxfmt --write` before committing so lefthook is a no-op.

## Tasks

- [x] **T1 — Tokens and type foundation**: `globals.css` color tokens (light/dark, `--brand-hue`), semantic `success`/`warning`/`info` (+ foreground) in `:root`, `.dark`, `@theme inline`; chart palette (dataviz-validated); fixed radius scale; swap Geist → IBM Plex Sans/Mono (verify fontsource packages); theme default `system`; AA contrast check of text pairs recorded here. Route: delegated (`react-staff`; CSS + theme provider + package deps).
- [x] **T2 — Component density and semantics**: fix `input-group.tsx` `rounded-[calc(var(--radius)-5px)]` (negative with the new 4px radius; lines 26, 69, 71); verify Storybook theme switching renders `.dark` tokens; Button/Input default `h-8`; Card border-only (no shadow); Badge rectangular + `success`/`warning`/`info` variants with stories; table row/cell density 13px + `tabular-nums`; status badges in members/invitations/users tables use semantic variants. Route: delegated (`react-staff`).
- [x] **T3 — Brand config and home redirect**: `brand.ts`; wire into auth brand panel, sidebar header/org switcher fallback, `index.html` title, PWA manifest + `theme_color`; `/` redirects (session → dashboard, else sign-in); docs. Route: delegated (`react-staff`).
- [x] **T4 — Shell**: follow-ups (a) from T1+T2 review ((b) done in T3); ink sidebar tokens in both modes, active item bar, header 48px, page header/title typography, breadcrumbs. Route: delegated (`react-staff`).
- [x] **T5 — Auth screens**: T3+T4 review follow-ups (a)–(d), (g); ink brand panel, no gradient, `size="lg"` controls, 28px title, mobile ink strip; check-inbox/verify/accept-invitation consistency. Route: delegated (`react-staff`).
- [x] **T6 — T5 review follow-ups** (authorized 2026-10-02): (a)–(f) from "Follow-ups from T5 review". Route: delegated (`react-staff`). Branch `feat/design-refresh-06-review-followups`. Reviewed alone from boundary `50b38e0`.

## Checks (every slice)

Node 26 (`nvm use`): `pnpm check-types`, `pnpm lint`, `bun test` (needs `base-template-postgres` via colima), `pnpm build`, `pnpm build-storybook`.

## Progress

| Task | Branch                                  | Commit(s)                                  | Checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Review                                                                                                                                                                                                                                                                                  |
| ---- | --------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | feat/design-refresh-01-tokens           | eb4f747                                    | Node 26: check-types ok; lint ok; bun test 1256 pass/0 fail; pnpm build ok; build-storybook ok; parent re-ran check-types ok. AA: all text pairs ≥4.99 (min success light); charts min ΔE 14.3 normal / 10.7 deuteranopia (dataviz skill not found, manual check). Deviation: added `--destructive-foreground`.                                                                                                                                                                                     | same group                                                                                                                                                                                                                                                                              |
| T2   | feat/design-refresh-02-components       | ab890dd                                    | Node 26: check-types ok; lint ok; bun test 1256 pass/0 fail; pnpm build ok; build-storybook ok. Badges solid fills (tinted failed AA in light). Storybook `.dark` verified working via addon source (not visually). Status mapping: admin users active→success, banned→destructive; sessions "This session"→info.                                                                                                                                                                                   | T1+T2 group, range d7d844e..ab890dd medium (1 lens: reliability), auto-consent, approved + acknowledged (review-f6fafdcf135e50c3); 1 warning + 3 suggestions, none blocking → follow-ups below                                                                                          |
| T3   | feat/design-refresh-03-brand            | 7f4870a                                    | Node 26: check-types ok; lint ok; bun test 1259 pass/0 fail; pnpm build ok (dist title + manifest verified); build-storybook ok; parent re-ran home-redirect test 2 pass/0 fail. `brand.ts` (name, tagline, logo, themeColor `#131c20` = light sidebar ink); `/` → `resolveHomeRedirect` (session → /dashboard, else /sign-in); removed `home-page.tsx` + `_public-header` layout (web health check gone, API `healthCheck` kept); follow-up (b) test added.                                        | same group                                                                                                                                                                                                                                                                              |
| T4   | feat/design-refresh-04-shell            | d3f185a                                    | Node 26: check-types ok; lint ok; bun test 1259 pass/0 fail; pnpm build ok; build-storybook ok; headless-Chrome screenshots of AppShell light/dark + AppSidebar light reviewed (mobile sheet, open dropdown, hover not visually verified). Follow-up (a): scoped token remap on `[data-slot=sidebar]` in globals.css; sidebar text pairs ≥7.27. Also fixed `@source` glob (pointed at `packages/apps`).                                                                                             | T3+T4 group, range ab890dd..d3f185a high (4 lenses), auto-consent, approved + acknowledged (review-18dfa03ef3ef0d93); 2 warnings + 8 suggestions, none blocking → follow-ups below                                                                                                      |
| T5   | feat/design-refresh-05-auth             | cb58f77 (T3+T4 follow-ups a–d, g), 50b38e0 | Node 26: check-types ok; lint ok; bun test 1265 pass/0 fail (parent re-ran full suite on final tree: 1265 pass/0 fail); pnpm build ok (dist title verified); build-storybook ok. Screenshots: sign-in layout light/dark at 1280px and 390px; status notice dark. Not visually verified: real route pages, error/pending states, other auth screens, hover/focus. (a) error → /dashboard, `_auth` guard owns the decision; (c) `logo.alt` dropped; (g) member role via cached `useActiveMemberRole`. | T5 alone, range d3f185a..50b38e0 high (4 lenses), auto-consent, approved + acknowledged (review-31930e6a59485d7f); 0 warnings + 8 suggestions → follow-ups below                                                                                                                        |
| T6   | feat/design-refresh-06-review-followups | ae1dce1, 5ee404e                           | RED: role-label + home-redirect tests failed (0 pass/2 fail, missing module/export) → GREEN; Node 26: check-types ok; lint ok; bun test 1272 pass/0 fail (full, after last edit); pnpm build ok; build-storybook ok; parent re-ran home-redirect + role-label 11 pass/0 fail. Input `size="lg"` variant; callers pass `w-full` on button links; spec marked superseded in part.                                                                                                                     | T6 alone, range 50b38e0..5ee404e high (4 lenses; risk lens relaunched once after a usage-limit transport failure), auto-consent, approved + acknowledged (review-d3dd9eb42187ee0a); 1 warning (stale tracker, resolved by this doc update) + 5 suggestions → remaining follow-ups below |

## Follow-ups from T1+T2 review

- (a) WARNING `globals.css:52-60` — ink sidebar in light mode: sidebar children using non-sidebar tokens (muted-foreground, default/secondary buttons, badges, popovers anchored inside) may render with wrong contrast. → T4 scope: audit sidebar subtree to use only `sidebar-*` tokens; add a light-mode sidebar story.
- (b) SUGGESTION `users-columns.tsx:96-99` — add render test for status badge mapping (banned/active). → T4 (alongside shell work) or T3.
- (c) SUGGESTION radius scale decoupled from `--radius`; T2 grep found no remaining `calc(var(--radius) - N)`. → no change needed; recorded.
- (d) SUGGESTION theme default now `system`; light-mode contrast of semantic badges on app screens only covered by stories. → covered by browser smoke at T5.

## Follow-ups from T3+T4 review

- (a) WARNING `routes/index.tsx:11-14` — `/` ignores `getSession()` error: during an API outage a signed-in user is sent to /sign-in. → T5: on error, route to `/dashboard` (its guard handles real failures) or show an error; also handle a rejected promise; test the route-level decision.
- (b) WARNING `vite.config.ts:10-13` — `brandHtml` relies on an exact empty `<title></title>` sentinel and does not escape the name. → T5: fail the build when the sentinel is missing and HTML-escape `brand.name`.
- (c) SUGGESTION `brand.ts:9` — `logo.alt` has no consumer. → T5: use it where the logo carries meaning (mobile ink strip / sidebar) or drop it.
- (d) SUGGESTION `globals.css:7` — `@source` glob fix unexplained. → T5: add a one-line comment.
- (e) SUGGESTION web API health indicator removed with the home page. → accepted; API `healthCheck` remains; no UI replacement (recorded).
- (f) SUGGESTION route tree regeneration — `routeTree.gen.ts` is gitignored (`.gitignore:13`); no action.
- (g) Parent note: org switcher shows a static "Organization" secondary line (filler). → T5: show the member's role instead, or remove the line.

## Follow-ups from T5 review (authorized 2026-10-02 → T6)

- (a) `routes/index.tsx:11-15` — rejected `getSession()` path is untested and the error is not logged.
- (b) `auth-card.tsx:20` — `description` without `title` is silently dropped (regression vs `title || description`).
- (c) `auth-status-notice.tsx:21` — `[&>a]:w-full` also stretches plain text links (e.g. "Back to sign in" in verify-email).
- (d) `auth-card.tsx:19` — inputs get h-10 via ancestor selector while buttons opt in with `size="lg"`; split mechanism.
- (e) `sidebar-org-switcher.tsx:71-75` — role label normalization untested; extract pure helper + test.
- (f) `docs/specs/dashboard-shell-and-auth-ui.md` still describes the old auth card layout and `/` home.
- Real-browser smoke of the app routes in both themes not run.

## Remaining follow-ups from T6 review (not authorized)

- `home-redirect.ts:28-34` — a resolved `{ error }` session lookup is forwarded without a log line; a synchronous throw from the getter escapes `.catch`.
- `auth-card.tsx:19-20` — no guard that inputs inside AuthCard use `size="lg"`; description-only header covered by a story only.
- `auth-status-notice.tsx:20` — callers must remember `className="w-full"` on button links.
- Real-browser smoke of app routes in both themes not run.

## Next step

Merged into `main` (fast-forward). Optional: the follow-ups above and a real-browser smoke.
