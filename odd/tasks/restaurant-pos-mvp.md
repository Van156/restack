# Feature: Restaurant POS MVP

- **Spec:** `.scratch/restaurant-pos-mvp/spec.md` (not committed). PRD `docs/prd/restaurant-management.md`, vocabulary `GLOSSARY.md`.
- **Branch:** `feat/restaurant-pos-mvp`, based on `docs/restaurant-prd` (PRD + glossary). Prototypes on `prototype/restaurant-pos` are behaviour references only; their code is not copied.
- **TDD:** on. Source: project `implement` skill ("use /tdd where possible, at pre-agreed seams") and the spec's Testing Decisions. Runner: `bun test` (unit `*.test.ts`, DB-backed `*.integration.test.ts`).
- **Review (RDD):** on (global). Per user review policy: one review per group of two tasks, auto-consent.
- **Delivery:** forecast well above 400 authored lines (~15k+). Strategy `ask-on-risk`; chain strategy pending a user decision. Commits are work units on the feature branch; no push or PR without the user.

## Objective

Implement the restaurant POS MVP described by the spec: the server domain (schema, permissions, procedures, invoicing port, sync, public Waiter call) and the web surfaces (setup, waiter, kitchen, cashier, cash shift, reports, staff, devices, guest page) with the client offline queue.

## Constraints

- Money is integer COP. Prices include impoconsumo 8% (franchise tax class: IVA 19%). Rounding is half up, once per line; the Bill total is the sum of line totals. The tip is a separate line outside the tax base.
- `organizationId` always comes from the authenticated context. Location scope is checked server-side inside every procedure (the Owner is exempt).
- Injectable clock in the API context and on the client. Business day uses America/Bogota.
- Polling (~1 s) instead of realtime, behind a replaceable transport.
- No test touches the real DIAN or real money. Production refuses the fake invoicing provider.
- Repo guards in `/tests` keep passing. Every new UI package component ships with a Storybook story.

## Tasks

Route per task: delegated writer (2+ non-trivial files); React work goes to `react-staff`.

- [x] **T1 — Restaurant foundation**: Location and Staff Location assignment schema; restaurant permission catalog and built-in Cashier and Waiter Roles; audit action additions; injectable clock in the API context; Location-scope helper; business-day helper; integration fixtures (Restaurant with two Locations, Staff of each Role). Locations CRUD procedures.
- [x] **T2 — Setup: room and menu**: Areas, Tables (bulk add), Stations, Menu categories, Menu items (tax class, cost, modifier groups), Station routing per Location, sold-out per Location, tax derivation helper, setup review warnings, menu CSV import (validate then commit) and template.
- [ ] **T3 — Staff PINs, Overrides and Paired devices**: invite with Role and Locations, assignments, PIN set/change/reset with lockout, PIN switch-in, Override minting (bound, short-lived, single-use), Paired device pairing code, redeem, rename, revoke, list.
- [ ] **T4 — Orders and Tickets**: Table session (open, move, request bill), append-only order lines (idempotent), remove unsent lines, send to kitchen (one Ticket per Station, blocked when unrouted), void sent line with Override, discount with Override, sold-out guard, Area deletion guard for open Bills (T2 deletes an Area together with its Tables; T4 must add the open-Bill check, e.g. a `hasOpenBillsInArea` query, in `areas.delete` and decide FK behaviour of Table sessions toward `dining_table`).
- [ ] **T5 — Kitchen display procedures**: list Tickets by Paired device or Staff member, advance status, timing metrics, ready marker on Tables.
- [ ] **T6 — Bill, tips and payments**: Bill computation, tip set/change/remove (also after issue), payments by tender with reference rules and change, settle, reopen with Override, buyer directory with consent.
- [ ] **T7 — DIAN and invoicing provider**: provider port, recording fake, Alegra adapter (sandbox contract test, skipped without credentials), fail-closed factory; DIAN choice (Owner only, audited), connection and habilitación state, issue document (idempotent per Bill and kind, POS default, factura on request, exempt receipt, Plan gate), outbox with retries and 48 h deadline, incident log, monthly document counter, background job.
- [ ] **T8 — Cash shift and tips distribution**: open (one per Location), ledger by tender, close with counted amounts and Override on difference, offline-registered takings, Tip beneficiaries (Owner and Administrators excluded), equal and percentage splits, distribution report.
- [ ] **T9 — Plans, reports and product health**: Plan and trial per Location, document counters, daily report by tender, Menu item and Staff member with cost and margin (missing cost flagged), Location filter, all-Locations view, kitchen metrics; Weekly Active and Activated Locations.
- [ ] **T10 — Sync**: batch sync with per-record results (applied, already applied, rejected) for order lines, voids, payments, Table metadata (last-write-wins), offline takings and document requests.
- [ ] **T11 — Waiter call**: signed Table session token and QR regeneration, public Hono sub-app (state and call only), reasons, one open call, cooldown, offline Location hiding, rate limiting; staff side list, "Voy", "Atendido".
- [ ] **T12 — Client offline queue module**: pure module with injected storage and clock (append-only records, backoff retries, 24/40/48 h alerts and block, Override-pending voids, document outbox, incident record).
- [ ] **T13 — UI package components**: floor-plan tile, order strip, Ticket card, Bill ledger, PIN pad, status badge, contingency ticket, QR panel, offline banner, with stories.
- [ ] **T14 — Web: setup wizard and staff/devices**.
- [ ] **T15 — Web: waiter floor plan and orders**.
- [ ] **T16 — Web: kitchen display (Paired device)**.
- [ ] **T17 — Web: cashier checkout and cash shift**.
- [ ] **T18 — Web: reports, Plan and DIAN settings, guest Waiter call page**.

## Acceptance criteria

The spec's user stories, proven through the seams in its Testing Decisions (oRPC in-process against real Postgres, invoicing port, pure offline queue, injectable clock).

## Checks (every task)

- After schema changes: `pnpm db:generate` then `pnpm db:test:prepare` (test DB on `localhost:5436`, container `base-template-postgres`).
- Focused: `bun test <changed test files>` during iteration.
- Closure: `pnpm check-types`, `pnpm lint`, `pnpm test` (whole suite, including `/tests` guards).

## Decisions

- Owner = better-auth `owner`, Administrator = `admin`. `cashier` and `waiter` are new built-in roles; `member` stays for compatibility with existing organizations.
- Location scope lives in one API helper used by every restaurant procedure; the Owner is exempt, everyone else needs a Staff Location assignment row.

## Progress

- Branch created from `docs/restaurant-prd`.
- **T1 done** (commits `a88e91f`, `e99a656`). Route: delegated writer. TDD RED-first (observed failing before implementation): permission catalog and roles (`org.test.ts`), business day (`business-day.test.ts`), Location scope (`location-scope.integration.test.ts`), restaurant router (`restaurant.integration.test.ts`, 19 tests). Schema and migration `restaurant_locations` generated with `drizzle-kit` (needs a dummy `DATABASE_URL`), clock plumbing and fixtures are infrastructure covered by the tests above. Checks: `pnpm db:test:prepare` ok, `pnpm check-types` ok, `pnpm lint` ok, `pnpm test` 1307 pass, 1 skip (storybook CSS), 0 fail.
  - Permission names: `subscription:[manage]`, `restaurant:[delete]`, `dian:[connect,choose]`, `setup:[manage]`, `staff:[manage]`, `report:[read]`, `override:[give]`, `cashShift:[manage]`, `billing:[charge]`, `order:[take]`, `menu:[soldOut]`. Built-in roles `cashier`, `waiter` (also in `BUILT_IN_ORG_ROLES`); `member` unchanged.
  - Helpers: `packages/api/src/lib/location-scope.ts` (`assertLocationAccess(ctx, locationId)`, `accessibleLocationIds(ctx)`; Owner exempt; foreign or missing Location is NOT_FOUND for the Owner and FORBIDDEN for others), `packages/db/src/lib/business-day.ts` (`businessDayBounds`, `businessDayOf`, fixed UTC-5), `packages/api/src/clock.ts` (`systemClock`), `Context.clock`.
  - New Location: plan `completo`, trial 30 days from `clock.now()`. Creation is Owner-only (plus `setup:manage`). Fixtures: `packages/api/src/testing/restaurant-fixtures.ts` (`createRestaurantHarness`).
- **T2 done** (commits `9350e96`, `8c02362`, `07827b7`, `d42859e`). Route: delegated writer. TDD RED-first (observed failing before implementation): tax helper (`tax.test.ts`), rooms (`rooms.integration.test.ts`, 18), menu and review (`menu.integration.test.ts`, 19), CSV parser and validator (`csv.test.ts`, `menu-csv.test.ts`, 16), CSV import (`menu-import.integration.test.ts`, 8). Schema and migration `20261003011335_dizzy_madame_hydra` are infrastructure covered by those tests. Checks: `pnpm db:generate` + `pnpm db:test:prepare` ok, `pnpm check-types` ok, `pnpm lint` ok, `pnpm test` 1376 pass, 1 skip, 0 fail.
  - Schema (`packages/db/src/schema/restaurant-setup.ts`): `area`, `dining_table` (TS `diningTable`), `station`, `menu_category`, `menu_item`, `menu_item_availability` (sold-out per Location), `modifier_group`, `modifier`, `station_routing`; enums `station_output`, `menu_tax_class`.
  - Tax helper: `packages/db/src/lib/tax.ts` `deriveTax(total, taxClass)` -> `{base, tax, total}` (BigInt half-up), `TAX_RATE_PERCENT`.
  - Routers under `appRouter.restaurant`: `areas`, `tables` (incl. `bulkCreate`), `stations`, `menu` (`categories.*`, `items.*`, `list`, `setRouting`, `setSoldOut`, `csvTemplate`, `importCsv`), `setup.review`.
  - Area deletion guard for open Bills is NOT implemented (no Table sessions yet): moved to T4.
