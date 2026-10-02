# Spec: Storybook for Base UI Components

- **Status:** Ready for review (all open questions resolved)
- **Date:** 2026-09-29
- **Stack:** Storybook `10.6.x` (`@storybook/react-vite`), React 19, Tailwind v4, shadcn (`base-lyra`, Base UI), `packages/ui`
- **Depends on:** `frontend-foundation.md` T1 (primitives in `packages/ui`) and T2 (import boundaries). Independent of its feature migrations (T4–T6).

## 1. Objective

Provide a Storybook that documents and previews **every base UI component** in `packages/ui`, where the base set is the **complete shadcn `ui` registry** for the project style, so that:

1. Developers can browse each primitive, its variants, sizes, and states in isolation, in light and dark mode.
2. Every component has generated docs (props table, usage) and an accessibility check.
3. It is impossible to add a primitive without a story (enforced by a test).

## 2. Scope

### In scope

- Storybook setup inside `packages/ui` (config, Tailwind styles, theme switching, a11y addon).
- Completing `packages/ui` with the shadcn registry items not yet added (§4.2).
- One `*.stories.tsx` per primitive, co-located with the component.
- A coverage test: every file in `packages/ui/src/components` has a matching stories file.
- `pnpm storybook` (dev) and `pnpm build-storybook` (static build) scripts; static build checked in CI-equivalent verification.
- README section: running Storybook and writing a story.

### Out of scope (v1)

- ~~Stories for app-level composed components (`apps/web/src/shared/**`) and feature components.~~ Now in scope: Storybook also loads `apps/web/src/**/*.stories.@(ts|tsx)`, per `dashboard-shell-and-auth-ui.md` decision 9. The `@/` alias, `withRouter` decorator (`apps/web/src/shared/storybook/with-router.tsx`, for components rendering TanStack `Link`) and the coverage registry (`tests/lib/app-story-registry.ts`, explicit list of presentational components that must have stories) support it. `packages/ui/src/**` still must not import `@/` or `web`; only `.storybook/main.ts` references `apps/web`.
- Interaction tests executed in CI (`play` functions, `@storybook/addon-vitest`, `@storybook/test-runner`) — the repo's test runner is `bun test`; revisit in v2.
- Visual regression testing (Chromatic or similar).
- Hosting/deploying the static Storybook.

## 3. Glossary

| Term              | Meaning                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| **Primitive**     | A shadcn registry `ui` item generated into `packages/ui/src/components`.                                   |
| **Story file**    | `<component>.stories.tsx` next to the component, CSF3 format, default export `meta` + named story exports. |
| **Docs page**     | Storybook autodocs page generated from `tags: ["autodocs"]`, component JSDoc, and `argTypes`.              |
| **Coverage test** | A `bun test` that fails when a primitive has no story file (§4.5).                                         |

## 4. Architecture

### 4.1 Location

```
packages/ui/
  .storybook/
    main.ts        framework @storybook/react-vite, stories glob, addons
    preview.tsx    imports ../src/styles/globals.css, theme decorator, global parameters
  src/components/
    button.tsx
    button.stories.tsx
    …
```

- Storybook lives in `packages/ui` because the stories document `packages/ui`; it needs nothing from `apps/web`. The existing boundary rule (`packages/ui/**` must not import `@/**` or `web`) applies to stories too.
- Stories glob: `../src/**/*.stories.@(ts|tsx)`.
- Build output `packages/ui/storybook-static/` is git-ignored and excluded from lint/format.

### 4.2 Base component set = full shadcn `ui` registry

Present today (from `frontend-foundation` T1): alert, alert-dialog, avatar, badge, breadcrumb, button, button-group, card, checkbox, combobox, command, dialog, dropdown-menu, empty, field, input, input-group, input-otp, item, kbd, label, native-select, pagination, popover, progress, radio-group, scroll-area, select, separator, sheet, sidebar, skeleton, sonner, spinner, switch, table, tabs, textarea, toggle, toggle-group, tooltip.

To add with the shadcn CLI (from `packages/ui`, same rules as frontend-foundation T1: never overwrite existing files, report any manual edit):

| Item            | Notes                                                   |
| --------------- | ------------------------------------------------------- |
| accordion       |                                                         |
| aspect-ratio    |                                                         |
| calendar        | adds a date-picker dependency (e.g. `react-day-picker`) |
| carousel        | adds `embla-carousel-react`                             |
| chart           | adds `recharts`                                         |
| collapsible     |                                                         |
| context-menu    |                                                         |
| drawer          | adds `vaul` (or Base UI equivalent for the style)       |
| hover-card      |                                                         |
| menubar         |                                                         |
| navigation-menu |                                                         |
| resizable       | adds `react-resizable-panels`                           |
| slider          |                                                         |
| direction       | RTL/LTR provider                                        |

**Excluded on purpose** (confirmed by the user, §9 Q1):

- `form` — built on react-hook-form; this project standardizes on TanStack Form (`frontend-foundation` §4.2).
- AI chat items (`attachment`, `bubble`, `marker`, `message`, `message-scroller`) — removed from the base by user decision (`frontend-foundation` F1.2).

The registry is the source of truth: when a new shadcn release adds a `ui` item, it is added to `packages/ui` with a story (the coverage test makes the story mandatory; adding the item itself is a manual decision).

### 4.3 Theming & styles

- `preview.tsx` imports `packages/ui/src/styles/globals.css` (Tailwind v4 + tokens). Tailwind must scan story files: verify `@source` coverage in `globals.css` (or the Storybook Vite config) so classes used only in stories are generated.
- Theme switching with `@storybook/addon-themes` `withThemeByClassName` (`light` / `dark` on `<html>`), matching the web app's `class` strategy (`next-themes` `attribute="class"`). Default: dark, as in the app.
- Components that need providers get them in the story's decorators, not globally, except: `TooltipProvider` (global decorator) and `Toaster` for the `sonner` story.

### 4.4 Story conventions

Every story file:

1. CSF3 with `satisfies Meta<typeof Component>`; `title: "UI/<Group>/<Name>"`, groups from §4.2 of `frontend-foundation` (Actions, Forms, Overlays, Navigation, Data display, Feedback, Layout).
2. `tags: ["autodocs"]`.
3. A `Default` story plus one story per meaningful variant, size, and state (disabled, invalid/`aria-invalid`, loading, empty, with icon…). Variants driven by `cva` are exposed as `argTypes` controls.
4. Composite components show a realistic composition (e.g. `Dialog` with header/body/footer and a trigger; `Sidebar` inside `SidebarProvider` with groups and a collapsed state; `Table` with pagination; `Field` bound to a `TanStack Form`-free controlled example).
5. Overlays render their trigger; stories are usable by clicking — no auto-open hacks unless the component supports a controlled `open` prop, in which case an `Open` story sets it.
6. No network, no app imports, no random data (deterministic fixtures, so docs and a11y results are stable).

### 4.5 Coverage & quality gates

- **Coverage test** (`bun test`): lists `packages/ui/src/components/*.tsx` (excluding `*.stories.tsx`) and asserts each has `<name>.stories.tsx`. Negative control required when implemented.
- **A11y**: `@storybook/addon-a11y` enabled globally with `parameters.a11y.test = "error"` in the UI panel; known false positives are disabled per story with a comment explaining why.
- **Build gate**: `pnpm build-storybook` must succeed (catches broken stories/imports) and is part of the verification checklist for every slice.
- `pnpm check-types` and `pnpm lint` cover story files.

### 4.6 Scripts

| Where         | Script                         | Runs                                    |
| ------------- | ------------------------------ | --------------------------------------- |
| `packages/ui` | `storybook`                    | `storybook dev -p 6006`                 |
| `packages/ui` | `build-storybook`              | `storybook build` → `storybook-static/` |
| root          | `storybook`, `build-storybook` | delegate to `packages/ui`               |

### 4.7 Toolchain risk

The workspace overrides `vite` with `@voidzero-dev/vite-plus-core@0.3.1` (`pnpm-workspace.yaml`). `@storybook/react-vite@10.6.1` declares `vite ^5 || ^6 || ^7 || ^8` as a peer. Compatibility with the override is **unverified** and is the first thing the setup slice checks (dev server + static build). Fallback, in order: (1) configure Storybook's `viteFinal` for the override; (2) give `packages/ui` a Storybook-only upstream `vite` via a scoped override; (3) stop and report to the user.

## 5. Requirements

### S0 — Setup

**S0.1 Dev server**

- WHEN a developer runs `pnpm storybook`
- THEN Storybook starts on port 6006 and renders a story with Tailwind styles applied.

**S0.2 Static build**

- WHEN `pnpm build-storybook` runs
- THEN it completes with no errors and writes `packages/ui/storybook-static/` (git-ignored).

**S0.3 Theme toggle**

- GIVEN any story
- THEN the toolbar switches between light and dark, and the component uses the matching tokens.

### S1 — Complete registry

**S1.1 All items present**

- GIVEN the shadcn `ui` registry for style `base-lyra`
- THEN every item except those excluded in §4.2 exists in `packages/ui/src/components`, and `pnpm check-types` passes.

### S2 — Stories

**S2.1 One story file per primitive**

- GIVEN any `packages/ui/src/components/<name>.tsx`
- THEN `<name>.stories.tsx` exists and follows §4.4.

**S2.2 Variants covered**

- GIVEN a component with `cva` variants or sizes
- THEN each variant and size is reachable from stories or controls.

**S2.3 States covered**

- GIVEN a form control
- THEN stories show default, disabled, and invalid states.

### S3 — Quality gates

**S3.1 Coverage enforced**

- WHEN a primitive is added without a story file
- THEN `bun test` fails, naming the component.

**S3.2 Accessibility**

- GIVEN any story
- THEN the a11y panel reports no violations, or each disabled rule has a justification comment in the story.

### S4 — Documentation

**S4.1 README**

- THEN the README documents how to run Storybook, how to write a story (conventions §4.4), and that a new primitive requires a story.

## 6. Proposed delivery slices

1. **Setup** — Storybook config in `packages/ui`, Tailwind + themes + a11y, scripts, `.gitignore`; toolchain check (§4.7); one sample story (`button`).
2. **Registry completion** — add the 14 missing items (§4.2).
3. **Stories: Actions + Forms** — button, button-group, toggle, toggle-group, input, input-group, input-otp, textarea, label, field, checkbox, radio-group, switch, select, native-select, combobox, slider, calendar.
4. **Stories: Overlays + Navigation** — dialog, alert-dialog, sheet, drawer, popover, hover-card, tooltip, dropdown-menu, context-menu, menubar, command, navigation-menu, breadcrumb, tabs, pagination, sidebar.
5. **Stories: Data display + Feedback + Layout** — card, table, badge, avatar, item, kbd, separator, scroll-area, aspect-ratio, accordion, collapsible, carousel, chart, resizable, empty, skeleton, alert, spinner, progress, sonner, direction.
6. **Gates + docs** — coverage test, a11y pass over all stories, README.

## 7. Non-functional requirements

- **No runtime impact:** Storybook and its addons are `devDependencies` of `packages/ui`; nothing ships in the web bundle.
- **Determinism:** stories use static fixtures; no `Math.random`/dates without fixed values.
- **Consistency:** stories import primitives the same way the app does (`@base-template/ui/components/<name>`), which also validates the package `exports`.

## 8. Acceptance criteria

- [ ] S0–S4 satisfied.
- [ ] Every primitive in `packages/ui/src/components` has a story file; coverage test passes with a negative control observed.
- [ ] `pnpm storybook` and `pnpm build-storybook` work on Node 26 with the workspace Vite override.
- [ ] Light and dark themes render correctly for all stories.
- [ ] `pnpm check-types`, `pnpm lint`, `bun test` pass.

## 9. Open questions

1. ~~"All shadcn components"~~ — **Resolved (user, 2026-09-29):** the full `ui` registry except `form` (react-hook-form; the project uses TanStack Form) and the AI chat items (removed from the base). Both stay excluded (§4.2).
2. ~~Sequencing~~ — **Resolved (user, 2026-09-29):** implementation starts after `frontend-foundation` is finished (avoids conflicts in `.oxlintrc.json`, `vite.config.ts`, `package.json`, and the lockfile; builds on the final structure).
