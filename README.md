# base-template

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Hono, ORPC, and more.

Documentation (specs, architecture notes and the code comment policy) is indexed in [docs/README.md](docs/README.md).

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Hono** - Lightweight, performant server framework
- **oRPC** - End-to-end type-safe APIs with OpenAPI integration
- **Bun** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Oxlint** - Oxlint + Oxfmt (linting & formatting)
- **PWA** - Progressive Web App support
- **Vite+** - Unified Vite toolchain, workspace task runner, linting, and formatting

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/server/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:

```bash
pnpm run db:push
```

Then, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).

## Branding

Edit `apps/web/src/app/brand.ts` (name, tagline, logo, PWA theme color) and `--brand-hue` in
`packages/ui/src/styles/globals.css` (color palette). `/` redirects to `/dashboard` when signed in
and to `/sign-in` otherwise. Details: [docs/architecture/web-app.md](docs/architecture/web-app.md#branding).

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Adding a UI primitive

Primitives come from the shadcn registry (style `base-lyra`, see `packages/ui/components.json`). Run the CLI from `packages/ui` so files land in `packages/ui/src/components`:

```bash
cd packages/ui
npx shadcn@4.21.0 add <name>   # e.g. accordion, popover, sheet
```

- Answer "no" to every overwrite prompt so existing components stay untouched.
- If a generated file imports `cn` from `"cn"`, rewrite it to `@base-template/ui/lib/utils`.
- Import primitives per file, never through a barrel:

```tsx
import { Button } from "@base-template/ui/components/button";
```

- Do not add the shadcn `form` item. Forms use TanStack Form with the `field` primitive and the shared `FormField`.
- `packages/ui` must stay app-agnostic: it cannot import from `@/**` or `web`.
- Write the primitive's story in the same change: `packages/ui/src/components/<name>.stories.tsx` (see [Storybook](#storybook)). `bun test` fails and names any primitive without one.

### Storybook

Every primitive in `packages/ui` is documented in Storybook, in light and dark mode, with autodocs and an accessibility panel.

```bash
pnpm storybook          # dev server at http://localhost:6006
pnpm build-storybook    # static build in packages/ui/storybook-static (git-ignored)
```

In a non-interactive shell (CI, scripts) prefix the commands with `CI=true` so Storybook does not prompt.

Stories live next to their primitive: `packages/ui/src/components/<name>.stories.tsx`. Config is in `packages/ui/.storybook/` (the theme switcher defaults to dark, like the app; `TooltipProvider` is applied globally).

Story conventions:

- CSF3 with `satisfies Meta<typeof Component>`, `title: "UI/<Group>/<Name>"` (groups: Actions, Forms, Overlays, Navigation, Data display, Feedback, Layout) and `tags: ["autodocs"]`.
- A `Default` story plus one story per meaningful variant, size and state (disabled, invalid, loading, empty, with icon). `cva` variants are exposed as `argTypes` controls.
- Overlays render their trigger so the story works by clicking; add a controlled `Open` story only when the component supports an `open` prop.
- Deterministic fixtures only: no network, no random data, no unfixed dates. No imports from `apps/web` or `@/**`.
- Import primitives per file, never through a barrel: `@base-template/ui/components/<name>`.
- Keep height out of classes on components that set an inline size (for example `ResizablePanelGroup`): size a wrapper element instead.

App stories: Storybook also loads `apps/web/src/**/*.stories.tsx` (titles `App/<Group>/<Name>`; the `@/` alias works). Components that render TanStack `Link` opt into the router context with `decorators: [withRouter]` from `@/shared/storybook/with-router`. Presentational app components that must have a story are listed in `tests/lib/app-story-registry.ts`; `bun test` fails naming any without a sibling `<name>.stories.tsx`.

Adding a primitive requires a story: `tests/ui-story-coverage.test.ts` (run by `bun test`) fails naming every `packages/ui/src/components/<name>.tsx` without a sibling `<name>.stories.tsx`.

Accessibility: the **Accessibility** panel runs axe on the current story. Rules are disabled only with a justification comment, either for all stories in `.storybook/preview.tsx` (document-level rules that cannot apply to component fragments) or per story via `parameters.a11y.config.rules`. Do not silence a real violation; fix the story markup or report the primitive.

Known accepted exceptions (all documented in the stories):

- Light-theme `color-contrast` (destructive text is about 4.1-4.3:1 and `muted-foreground` on `muted` about 4.34:1, against the 4.5:1 target) is disabled on the affected stories: `Button`/`Badge`/`Alert` `Destructive`, `AlertDialog` `WithMedia` and `Open`, `Avatar` `Fallback` and `Group`, `Kbd` `Group` and `InText`. Design tokens in `globals.css` are out of scope for the Storybook work; the dark theme has no violations. Revisit with a theme task.
- `Command` `Default`, `Empty` and `Open` disable `aria-required-children`: cmdk hard-codes `role="separator"` inside its listbox and the wrapper cannot override it.

`play` functions in stories are not executed in v1, because there is no Storybook test runner. They are documentation until v2. Likewise `parameters.a11y.test = "error"` only fails a run under a test runner; in the UI it is informational.

`bun test` also checks that the built Storybook CSS contains a class used only in a story (proving Tailwind scans stories). That check is skipped with a warning until `pnpm build-storybook` has produced `packages/ui/storybook-static`.

### Dashboard shell and auth components

The authenticated shell and the auth screens follow the `template-dashboard` design (shadcn `base-vega` style, IBM Plex, `text-sm` controls). The rules live in [docs/specs/dashboard-shell-and-auth-ui.md](docs/specs/dashboard-shell-and-auth-ui.md).

- **Shell** (`apps/web/src/shared/components/layout/`): `AppShell`, `AppSidebar` (icon-collapsible, collapsible parents from `NavItem.children`), `AppHeader`, `AppBreadcrumbs`, `SidebarOrgSwitcher`, `SidebarUserMenu`. Navigation comes from `navGroups` in `apps/web/src/app/navigation.ts`; breadcrumbs and settings/admin tabs are derived from it by the pure helpers in `shared/lib/navigation.ts`. The org switcher and user menu containers live in `features/organizations` and `features/auth`.
- **Auth screens** (`apps/web/src/features/auth/components/`): `AuthLayout`, `AuthCard`, `AuthBrandPanel`, `AuthFormError`, `AuthSwitchPrompt`, `SocialSignInButtons`. Routes: `/sign-in` and `/sign-up` (the check-inbox screen is a state of `/sign-up`), `/verify-email` and `/accept-invitation/$id` under the `_public-auth` layout. `/login` only redirects to `/sign-in`, keeping `redirect` and `invitationId`.
- **Stories**: presentational shell and auth components have `App/...` stories (light and dark) next to them. Components that render TanStack `Link` use `decorators: [withRouter]` from `@/shared/storybook/with-router`; set the initial URL with `parameters.routerPath`. New presentational components are added to the story registry `tests/lib/app-story-registry.ts`, and `bun test` fails if a registered component has no story.
- **Google sign-in**: optional, see [Google sign-in](#google-sign-in-optional) for the OAuth client setup and environment variables.

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Adding a feature

The web app (`apps/web/src`) is organised by feature. A new feature touches three places only: its own folder, one route file, and the navigation config.

1. **Feature folder** `apps/web/src/features/<name>/` with an `index.ts` as its public API (for example `components/`, `lib/`, `hooks/` inside). Import your own modules relatively; use `@/features/<name>` only from other features or from routes, and never deep-import (`@/features/<name>/components/...`).

   ```ts
   // apps/web/src/features/reports/index.ts
   export { default as ReportsPage } from "./components/reports-page";
   ```

2. **Thin route** in `apps/web/src/routes/`. It only composes the feature: no queries or domain logic, ideally under about 60 lines.

   ```tsx
   // apps/web/src/routes/_auth/_org/reports.tsx
   import { createFileRoute } from "@tanstack/react-router";

   import { ReportsPage } from "@/features/reports";

   export const Route = createFileRoute("/_auth/_org/reports")({
     component: ReportsPage,
   });
   ```

3. **Sidebar entry** by editing only `apps/web/src/app/navigation.ts`. Add an item to an existing group, or a new group. `visible` is an optional UX-only predicate over `NavContext` (currently `{ isSuperadmin }`) on items and groups. Pages still enforce their own permissions.

   ```ts
   {
     id: "reports",
     label: "Reports",
     visible: (ctx) => ctx.isSuperadmin,
     items: [{ label: "Reports", to: "/reports", icon: FileText }],
   },
   ```

Boundaries are enforced by oxlint (`no-restricted-imports` in `.oxlintrc.json`): `shared/` cannot import from `features/` or `routes/`, `packages/ui` cannot import from the app, and feature deep imports are rejected. `tests/lint-boundaries.test.ts` proves those rules fire. Oxlint cannot express "the feature I am in", so `tests/feature-self-import.test.ts` fails if a feature imports itself through `@/features/<name>`.

Lint config notes:

- In `.oxlintrc.json` a later `overrides` entry replaces, not merges, the `no-restricted-imports` config of earlier entries. That is why the `apps/web/src/shared/**` override repeats the deep-import pattern.
- `vite.config.ts` imports `.oxlintrc.json`, so `pnpm lint` (`vp lint`) uses the same rules.

## Environment Configuration

Each app owns its environment schema in `.env.schema`. Varlock generates `src/env.ts` during installation; run `pnpm run env:generate` after changing a schema. Commit schemas, and keep secrets in ignored env files or your deployment platform.

Import the generated `ENV` accessor in application code. Shared database and auth packages receive configuration or initialized clients from the application. See [Varlock's monorepo guide](https://varlock.dev/guides/monorepos/).

For Cloudflare, Alchemy loads and validates deployment inputs with `varlock/auto-load` in its Node/Bun deployment process. Worker code reads native bindings; web clients use the framework's public env API through `src/env.public.ts` where needed. Alchemy supplies resource URLs and managed database credentials. In-Worker Varlock protections are deferred until an official Alchemy integration is available; see [the non-Wrangler deployment guidance](https://varlock.dev/integrations/cloudflare/#non-wrangler-deploy-tools-alchemy-sst-pulumi).

Bun's automatic env loading is disabled in `bunfig.toml`; the framework integration or server bootstrap loads Varlock. Node deployments must include Varlock and its dependencies alongside the app schema.

Run standalone Node/Bun tools that use Varlock from the owning app directory so they load that app's schema and env files. `env:generate` only generates TypeScript files; it does not initialize environment values in a subsequent command.

## Deployment

### Alchemy

- Target: web on Cloudflare
- Configure provider accounts: `cd packages/infra && pnpm exec alchemy profile edit`
- Dev: pnpm run dev
- Deploy: pnpm run deploy
- Destroy: pnpm run destroy

`alchemy profile edit` stores the selected Axiom, Cloudflare, Neon, PlanetScale, and/or Prisma provider profiles under `~/.alchemy`; no provider-specific setup command is required by this scaffold.

Deploys are staged and default to a personal `dev_<username>` stage. For production, run the deploy with an explicit stage from `packages/infra`:

```bash
cd packages/infra && pnpm exec alchemy deploy --stage production
```

### Docker Compose

- Target: server
- Config: `docker-compose.yml` (app Dockerfiles live in `apps/*/Dockerfile`)
- Build images: pnpm run docker:build
- Start: pnpm run docker:up
- Logs: pnpm run docker:logs
- Stop: pnpm run docker:down

Environment variables are read from each app's `.env` file (baked into web builds for public variables) and overridden in `docker-compose.yml` for container networking.

For more details, see the guide on [Deploying with Docker Compose](https://www.better-t-stack.dev/docs/guides/docker).

## Git Hooks and Formatting

- Run checks: `pnpm run check`

## Project Structure

```
base-template/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Router)
│   └── server/      # Backend API (Hono, ORPC)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run dev:server`: Start only the server
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run db:push`: Push schema changes to database
- `pnpm run db:generate`: Generate database client/types
- `pnpm run db:migrate`: Run database migrations
- `pnpm run db:studio`: Open database studio UI
- `pnpm run check`: Run Vite+ format/lint checks and workspace TypeScript checks
- `pnpm run lint`: Run Vite+ lint checks
- `pnpm run format`: Run Vite+ formatting
- `pnpm run staged`: Run Vite+ checks against staged files
- `cd apps/web && pnpm run generate-pwa-assets`: Generate PWA assets
- `pnpm run docker:build`: Build the Docker Compose images
- `pnpm run docker:up`: Build and start the Docker Compose stack
- `pnpm run docker:logs`: Tail logs from the Docker Compose stack
- `pnpm run docker:down`: Stop the Docker Compose stack

## Better Auth Schema Generation

After changing auth plugins or schema options, run `pnpm run auth:generate` from the project root. The script runs the Better Auth CLI through `varlock run` from the owning app directory, loading the auth instance from `src/services.ts`. Review the schema changes, then use your ORM's migration workflow to apply them.

## Authentication, Multi-tenancy & RBAC

This template ships a full multi-tenant auth system on top of better-auth: organizations, dynamic per-organization roles, an isolated platform-superadmin layer, and an append-only audit log. Full requirements and design live in [`docs/specs/auth-multitenant-rbac.md`](docs/specs/auth-multitenant-rbac.md) — this section is a short map, not a replacement for it.

- **Organizations** — every user can belong to one or more organizations (tenants) and switch the active one; every tenant-scoped query is filtered by the session's active organization, never by client input. Wired in `packages/auth/src/index.ts` (better-auth's `organization` plugin).
- **Dynamic roles** — the built-in `owner`/`admin`/`member` roles and every organization's own custom roles are checked against one code-defined permission catalog (`packages/auth/src/permissions/org.ts`). Custom roles are created at runtime and stored per organization; adding a new permission needs no database migration (see below).
- **Platform superadmin** — a separate, isolated layer (better-auth's `admin` plugin, `packages/auth/src/permissions/platform.ts`) for operator actions across every tenant: list/search users and organizations, ban/unban, override a user's organization limit, and impersonate. An org `owner` holds no platform permissions, and a `superadmin` is not implicitly a member of any organization — the two layers never grant each other.
- **Audit log** — every organization and platform action (member/invitation/role changes, bans, impersonation, organization-limit overrides, ...) is written through one `AuditLogger` port (`packages/auth/src/audit/`), queryable per organization (`/settings/activity`) or platform-wide (`/admin/activity`), with a configurable retention job.

### Adding a feature permission

Adding and enforcing a new permission touches the catalog (one file) and the procedure that guards it. As a concrete, real example, here is the template's own demo `project` feature:

1. **Catalog** — add the feature and its actions to `orgStatements` in `packages/auth/src/permissions/org.ts`, and grant it to the built-in roles that should have it:

   ```ts
   // packages/auth/src/permissions/org.ts
   export const orgStatements = {
     ...withoutTeam(orgDefaultStatements),
     audit: ["read"],
     project: ["create", "read", "update", "delete"], // ← your feature goes here
   } as const;

   export const owner = orgAc.newRole({
     ...withoutTeam(orgBuiltInOwnerAc.statements),
     audit: ["read"],
     project: ["create", "read", "update", "delete"],
   });
   // ...same idea for `admin` and `member`, granting only what each should have.
   ```

2. **Enforce it in an oRPC procedure** — guard a handler with `orgProcedure` + `requirePermission`, which is type-checked against the catalog (a misspelled feature/action is a compile error):

   ```ts
   // packages/api/src/routers/project.ts
   import { orgProcedure, requirePermission } from "../index";

   export const projectRouter = {
     list: orgProcedure.use(requirePermission({ project: ["read"] })).handler(({ context }) => {
       return projectsByOrganization.get(context.org.id) ?? [];
     }),
     // create/update/delete follow the same pattern with their own action.
   };
   ```

3. **Gate the UI (optional, UX only)** — `useCan("feature:action")` hides or disables the corresponding control; the server above remains the sole authority regardless of what the UI renders:

   ```ts
   // apps/web/src/routes/_auth/_org/settings/members.tsx
   const { can: canRemove } = useCan("member:delete");
   // ... <Button disabled={!canRemove} onClick={...}>Remove</Button>
   ```

A brand-new feature's permissions are assignable from the roles editor (`/settings/roles`) automatically — it groups the UI by reading the same catalog (`groupCatalogByFeature`, `apps/web/src/features/access-control/lib/role-catalog.ts`), so nothing there needs to change either. The only case that needs a third file is exposing an entirely new router (rather than adding to an existing one) over oRPC: register it once in `packages/api/src/routers/index.ts`'s `appRouter` — that's ordinary API routing, not part of the permission mechanism itself.

### API boundary: better-auth client vs. oRPC

Session and identity actions — sign-in/up, email verification, organization membership/invitations/role changes, and platform admin actions like ban/unban/impersonate — go through better-auth's own client (`authClient`, `apps/web/src/app/auth-client.ts`), calling `/api/auth/*` directly rather than being wrapped in an oRPC procedure. Everything else (this template's actual app features, e.g. `packages/api/src/routers/project.ts`) goes through oRPC.

This split exists because better-auth's endpoints for these actions read and write the session cookie themselves (sign-in, impersonate, and stop-impersonating all mutate it as a side effect) — going through better-auth's client keeps that cookie handling native and correct without extra plumbing, keeps this template's auth surface aligned with better-auth's own upgrade path, and every one of these calls still fires the same hooks the audit log (`packages/auth/src/audit/after-hooks.ts`) listens to, so nothing here bypasses R7's audit coverage.

### Auth, email & audit environment variables

Each app owns its own `.env.schema` (see "Environment Configuration" above); these are the auth/email/audit-related entries.

`apps/server/.env.schema`:

| Variable                    | Required?                                   | Default              | Purpose                                                                                                                                            |
| --------------------------- | ------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`        | required                                    | —                    | better-auth session/token signing secret (min. 32 chars).                                                                                          |
| `BETTER_AUTH_URL`           | required                                    | —                    | better-auth's own base URL.                                                                                                                        |
| `CORS_ORIGIN`               | required                                    | —                    | The web app's origin; also the base URL for links built into invitation/verification emails.                                                       |
| `DATABASE_URL`              | required                                    | —                    | Postgres connection string for the app database.                                                                                                   |
| `RESEND_API_KEY`            | optional                                    | unset                | When set, selects the Resend email adapter instead of the console adapter (must start with `re_`).                                                 |
| `EMAIL_FROM`                | optional (required in practice with Resend) | unset                | Verified sender address; `createEmailSender` throws at startup if `RESEND_API_KEY` is set without it.                                              |
| `GOOGLE_CLIENT_ID`          | optional                                    | unset                | Google OAuth client ID. Set together with `GOOGLE_CLIENT_SECRET` to enable "Continue with Google"; setting only one fails startup. Server-only.    |
| `GOOGLE_CLIENT_SECRET`      | optional                                    | unset                | Google OAuth client secret (see above). Server-only, never exposed to the web bundle.                                                              |
| `DEFAULT_MAX_ORGS_PER_USER` | required                                    | `3`                  | R1.1b: organizations a user may own before being blocked, unless overridden per-user.                                                              |
| `AUDIT_LOG_RETENTION_DAYS`  | optional                                    | unset (keep forever) | R7.6: when set, the scheduled retention job purges `audit_log` rows older than this many days.                                                     |
| `PLATFORM_ADMIN_EMAILS`     | optional                                    | unset                | Comma-separated emails promoted to `superadmin` by `pnpm db:seed:admins` (R6.1). Never read by the running server or exposed through any endpoint. |

`apps/web/.env.schema` has no auth-specific variables beyond `VITE_SERVER_URL` (the API base URL, already documented above).

Integration tests use a separate variable, `TEST_DATABASE_URL` (not part of any `.env.schema` — read directly by `packages/db/src/testing.ts`, `DATABASE_URL` is deliberately ignored by tests). It defaults to `postgresql://postgres:password@localhost:5436/base_template_test` if unset; see "Local Development & Testing" below.

### Google sign-in (optional)

"Continue with Google" appears on `/sign-in`, `/sign-up` and the invitation sign-up page only when the server has Google credentials; without them the button is hidden and nothing else changes. The web app asks `GET <server-origin>/api/public/auth-providers`, which returns provider ids only (for example `{ "providers": ["google"] }`).

1. In the [Google Cloud console](https://console.cloud.google.com/apis/credentials), create an OAuth client of type **Web application** (configure the OAuth consent screen first if prompted).
2. Add the authorized redirect URI `<server-origin>/api/auth/callback/google`, where `<server-origin>` is `BETTER_AUTH_URL` (for local development `http://localhost:3000/api/auth/callback/google`).
3. Put the client ID and secret in `apps/server/.env.local` (never commit them):

   ```
   GOOGLE_CLIENT_ID=<your-client-id>
   GOOGLE_CLIENT_SECRET=<your-client-secret>
   ```

4. Restart the server. Setting only one of the two variables fails startup with a message naming the missing one.

Behaviour worth knowing:

- A Google sign-in whose email matches an existing email/password account links to it only when Google reports the email as verified and the local account's email is verified too; otherwise it is rejected and the sign-in page shows an error. An unverified Google email never gets a session.
- Google sign-up through an invitation link is allowed only when the Google account's verified email equals the invited email. A mismatch is rejected before any account is created and the invitation stays pending. Signing in never accepts an invitation implicitly; accepting still happens on `/accept-invitation/$id`.

### Seeding the first superadmin

1. Set `PLATFORM_ADMIN_EMAILS` (comma-separated) in `apps/server/.env`.
2. Sign up each of those emails as an ordinary user first — the seed command only **promotes an existing account**, it never creates one.
3. Run `pnpm db:seed:admins` from the project root.

The command (`apps/server/scripts/seed-admins.ts`, logic in `packages/auth/src/admin-seed.ts`) is idempotent: re-running it skips anyone already `superadmin` and reports (without failing) any email with no matching account yet, so it's safe to run again after new admins sign up. There is no endpoint for this — promoting to `superadmin` is only ever done through this command (R6.1).

### Known limitations

See `docs/specs/auth-multitenant-rbac.md` §8 for the full write-up. In short:

- **Organization-limit race (R1.1b)** — two concurrent `createOrganization` calls from the _same_ user can both pass the limit check before either insert commits, temporarily exceeding the limit by one. This is a UX guardrail, not a security boundary, and better-auth 1.7.5 gives no safe way to close the window without a much larger change (see the spec for why).
- **Retention job has no cross-process coordination** — each running replica starts and owns its own independent purge timer (`packages/auth/src/audit/retention-job.ts`); this is safe because the purge is idempotent (an already-deleted row just doesn't match a later replica's query), so overlap costs redundant round-trips, never incorrect data.
- **The email-verification resend cooldown (R0.3) is client-side only** — a 60s button cooldown, with no server-side rate limit yet on `/send-verification-email`.
- **A few UX placeholders, chosen deliberately over guessing a design with no spec backing**: no `Dialog`/confirmation-modal component exists yet in `packages/ui` (destructive actions use `window.confirm`); there is no organization-deletion page or button (better-auth supports it, but neither the spec's routes table nor R3/R4 require it); and a signed-out invitee sees a generic sign-up form with no organization-name/email preview (better-auth's own invitation-preview endpoint requires a session, and no public preview endpoint exists).

## Local Development & Testing

- **Node version**: this repo pins Node 26 in `.nvmrc` — run `nvm use` before any `node`/`pnpm`/`bun` command.
- **Postgres for tests**: integration tests use a _dedicated_ database, never the app's dev database. Start Postgres on port 5436 (matching `TEST_DATABASE_URL`'s default) and prepare the test database once:

  ```bash
  POSTGRES_PORT=5436 pnpm db:start   # docker compose up -d postgres, mapped to :5436
  pnpm db:test:prepare               # creates base_template_test (if missing) and runs migrations
  ```

  `pnpm db:test:prepare` (`packages/db/scripts/prepare-test-db.ts`) refuses to run against any database whose name doesn't end in `_test`, so it can never target a real database by mistake.

- **Running tests**: `bun test` from the project root runs every package's tests (unit + integration) via Bun's own test runner. An integration suite that can't reach the test database warns and skips locally, but fails loudly instead when `CI` is set — so a broken pipeline can't silently report a green run with zero integration coverage.
- **Dev email flow**: without `RESEND_API_KEY` set, `createEmailSender` (`packages/auth/src/email/factory.ts`) selects `ConsoleEmailSender`, which prints invitation and verification links straight to the server's console/logs instead of sending real email — the whole invite → accept and sign-up → verify flow works end to end locally with no email provider configured. `createEmailSender` refuses to fall back to the console adapter in production (`NODE_ENV=production` without `RESEND_API_KEY` throws at startup) so verification/invitation tokens can never accidentally end up in a production log instead of an inbox.
