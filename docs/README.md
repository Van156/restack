# Documentation

- [`specs/`](./specs/): requirements and design decisions, written before or alongside a feature.
- [`architecture/`](./architecture/): how the code implements them. Long rationale that does not fit in a code comment lives here.
- [`prd/`](./prd/): product requirements for a feature set, handed off to specs and tickets.

## PRDs

- [Restaurant management MVP](./prd/restaurant-management.md)

## Specs

- [Auth, multi-tenancy and RBAC](./specs/auth-multitenant-rbac.md)
- [Dashboard shell and auth UI](./specs/dashboard-shell-and-auth-ui.md)
- [Data table](./specs/data-table.md)
- [Frontend foundation](./specs/frontend-foundation.md)
- [Storybook](./specs/storybook.md)

## Architecture

- [API authorization](./architecture/authorization.md): procedures, permission checks, the authorization and platform admin ports, web permission checks.
- [Auth](./architecture/auth.md): better-auth setup, invitation flow, audit hooks, platform lists, test harness.
- [Audit log](./architecture/audit-log.md): write pipeline, request context, retention job, reads.
- [Web app pages and routes](./architecture/web-app.md): permission-gated pages, org guard and onboarding, admin area, audit log pages, invitation acceptance.
- [Data table](./architecture/data-table.md): URL search shape, hook contract, simple and advanced modes, server list queries, date windows.

## Comment policy

Applied to all own code. Components copied from shadcn and tablecn keep their upstream comments.

- Exported symbols: one-line `/** ... */`. Inline comments only for a non-obvious why (invariant, workaround, security). Never restate what the code does.
- Max ~3 lines per comment block. Longer rationale moves to `docs/architecture/<topic>.md`, and the code keeps one line plus `See docs/architecture/<topic>.md#<anchor>`.
- No history in code (task ids, "follow-up", review notes, "previously ..."). That lives in commits and `odd/`.
- Requirement ids stay as short tags (`R4.6`) without prose.
- Keep MIT attribution headers and `oxlint-disable` justifications.
- Trimming must not drop a behavioral contract: edge cases (what an empty list means, a truth table), invariants, security reasons and the why of a cast or workaround stay either as a one-line comment or in the linked doc section.
