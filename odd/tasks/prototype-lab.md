# Feature: Prototype Lab

- **Source:** user request 2026-10-02 + `prototype` skill (UI branch, sub-shape B).
- **Tracker branch:** `feat/prototype-lab` from `main` (`7352587`).
- **Delivery:** strategy `ask-on-risk`; forecast ~350–500 authored changed lines.
- **TDD:** off (visual dev tooling) — source: project convention (TDD on only for server/auth/API). Runner for ordinary checks: `bun test`.
- **Review (RDD):** on (global); user policy: review every two tasks, auto-consent. Group: T1+T2. First boundary: `7352587`.

## Objective

A public, login-free, dev-only lab at `/prototype` for visualizing a new feature before implementing it: several radically different UI variants per idea, switchable via `?variant=` and a floating bar, built from `@base-template/ui` components with in-memory mock data (no API, no auth, no DB).

## Problem / why

Feature ideas are currently judged on paper or in Storybook stories of single components. There is no fast place to see a whole screen in a few structural variants before committing to a spec.

## Scope

- Public route tree `/prototype` (outside `_auth` / `_public-auth`), unreachable in production builds (`notFound()` when `import.meta.env.PROD`).
- Lab index listing registered prototypes.
- Shared `PrototypeSwitcher` (bottom-centre pill, ←/→ buttons and keys, ignores focused inputs, URL-synced, hidden in production).
- One example prototype with 3 structurally different variants using base components and mock data.
- Short how-to doc for adding a prototype.

## Constraints

- No backend calls, no auth, no persistence; mock data lives next to the prototype.
- Follow TanStack Router file conventions; no new top-level structure in the monorepo.
- Individual idea prototypes are throwaway (own `prototype/<name>` branch per the skill); only the lab infra + example live on main.

## Tasks

- [x] **T1 — Lab infra**: `/prototype` layout route (dev-only guard, minimal lab chrome), index catalog from a registry, `PrototypeSwitcher` + variant search-param handling. Route: delegated (react-staff writer, 2+ non-trivial files).
- [x] **T2 — Example + docs**: `/prototype/example` with 3 structurally different variants on base components and mock data; how-to doc for adding a prototype. Route: delegated (same writer).
- [x] **T3 — Lab sidebar**: base `Sidebar` in the lab layout listing registered prototypes, with their variants as sub-items (`?variant=` links, active state), trigger + mode toggle. Route: inline (user request 2026-10-02; one new file + layout edit). Then merge `feat/prototype-lab` into `main` (user request).

## Acceptance criteria

- `pnpm dev:web` → `/prototype` loads without signing in and lists the example.
- `/prototype/example?variant=B` renders variant B; ←/→ (bar or keys) cycles and updates the URL.
- Production build: `/prototype` resolves to not-found and the switcher never renders.
- `check-types`, `oxlint`, `oxfmt` pass.

## Checks

- `pnpm --filter web check-types`
- `pnpm check`

## Progress

- Created 2026-10-02.
- T1 done — commit `7a90e8f`. Checks: `pnpm check` pass; `pnpm --filter web check-types` pass (0 errors).
- T2 done — commit `52affaf`. Same checks pass; `routeTree.gen.ts` (gitignored) contains `/prototype/` and `/prototype/example`.
- Review T1+T2 (base `7352587`, through `5c71385`): consent granted (standing), 1 lens (reliability), **approved**, acknowledged (authority burned). Non-blocking follow-ups: R3-variant-logic-untested (WARNING), R3-empty-variants-crash, R3-arrow-key-hijack, R3-timezone-nondeterminism, R3-prod-guard-unverified (SUGGESTION). Next boundary: `5c71385`.
- Not verified: manual browser run, production-build not-found behaviour.
- T3 done — commit `c40ccf2` (inline). Checks: `pnpm check` pass; `pnpm --filter web check-types` pass. `Link search` needs a cast because registry `to` is a route union (commented in code).
- Review T3 alone (base `5c71385`, through `c40ccf2`): consent granted (standing), reliability lens, **approved**, acknowledged. Non-blocking follow-ups: R3-mobile-sheet-stays-open (WARNING: mobile sidebar sheet does not close after picking a link), R3-sidebar-active-state-untested (WARNING), R3-variant-search-cast-unchecked, R3-progress-log-omits-sidebar (SUGGESTION).
- Merged `feat/prototype-lab` into `main` on user request (2026-10-02). Not pushed.
- Follow-up R3-mobile-sheet-stays-open fixed — commit `8824a51` on `fix/prototype-lab-mobile-sidebar` (inline): all lab sidebar links close the mobile sheet, mirroring `AppSidebar`. Checks: `pnpm check` pass; `pnpm --filter web check-types` pass. Review: consent granted (standing), reliability lens, **approved**, acknowledged; 1 SUGGESTION. Merged into `main` (user request). Not pushed. Not browser-verified.
- Next: remaining optional follow-ups; push is the user's call.
