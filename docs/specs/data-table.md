# Spec: Reusable Data Table — Adapt `tablecn`

- **Status:** Approved (all decisions in §10 resolved)
- **Date:** 2026-09-30
- **Stack:** React 19, TanStack Router + Query, `@tanstack/react-table` 9.x, oRPC, Drizzle, Base UI shadcn primitives in `packages/ui`, Storybook 10, `bun:test`
- **Depends on:** `frontend-foundation.md` (layer direction, import boundaries, feature structure), `storybook.md` (story convention and coverage tests), `dashboard-shell-and-auth-ui.md` (visual foundation, `apps/web` stories).
- **Reference:** [`sadmann7/tablecn`](https://github.com/sadmann7/tablecn) at `5c2a102213be4adef1b4b48df188c6a2272cbe49`, MIT (© 2024 Sadman Sakib). Read-only; copied code keeps the MIT notice.

## 1. Objective

Replace the minimal shared `DataTable` in `apps/web` with a reusable, server-driven data table adapted from tablecn's **Base UI variant** (`src/registry/bases/base/*`): sortable column headers, faceted/text/date/range filters, column visibility, row selection with an action bar, pagination, a loading skeleton, and the advanced filter builder (filter list and filter menu with `and`/`or` join) and multi-column sort list, with table state persisted in the URL.

The adaptation keeps tablecn's column-meta driven API (`meta.variant`, `meta.options`, …) and its component composition, and replaces its Next.js specifics (nuqs auto-adapter, server components, `"use cache"`, `React.use(promise)`, drizzle-only `filterColumns`) with base-template conventions: TanStack Router search params, TanStack Query via oRPC, and the existing loading/empty/error states.

## 2. Scope

### In scope

- **Primitives** missing from `packages/ui` that tablecn needs, each with a story: `faceted` and `sortable` (dnd-kit wrapper); `action-bar` if the Base variant needs its own (the reference ships it only for Radix).
- **Table system** in `apps/web/src/shared`: `DataTable`, `DataTableToolbar`, `DataTableColumnHeader`, `DataTableViewOptions`, `DataTableFacetedFilter`, `DataTableDateFilter`, `DataTableSliderFilter`, `DataTablePagination`, `DataTableSkeleton`, `DataTableActionBar`, `DataTableAdvancedToolbar`, `DataTableFilterList`, `DataTableFilterMenu`, `DataTableSortList`, select-column helper, and the `useDataTable` hook (with `enableAdvancedFilter`).
- **Pure logic modules** (unit-tested): operator config, search-param schemas (sort, filters, pagination), valid-filter pruning, page/offset mapping.
- **Server contract**: a shared zod list input (`page`, `perPage`, `sort[]`, `filters[]`, `joinOperator`) and a Drizzle adapter that turns it into `where`/`orderBy`/`limit`/`offset` plus `total`.
- **Preserved states** from the current table: loading, empty, error with retry, refetch error, out-of-range page recovery (`shared/lib/data-table-state.ts`).
- **Migration** of the existing consumers (§7) and removal of the old table API.

### Out of scope

- tablecn's **data-grid** (editable, virtualized grid), CSV import, realtime/partykit, uploadthing.
- The Radix variant, `@tanstack/react-db`, `@tanstack/react-virtual`.
- Changing RBAC or procedure permissions; lists keep their existing guards.
- Mutating bulk actions (bulk revoke, ban, delete).

## 3. Glossary

| Term            | Meaning                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Reference**   | tablecn at the pinned commit, Base UI variant.                                                                                    |
| **Column meta** | Typed per-column metadata: `label`, `placeholder`, `variant`, `options`, `range`, `unit`, `icon`.                                 |
| **Variant**     | Filter kind of a column: `text`, `number`, `range`, `date`, `dateRange`, `boolean`, `select`, `multiSelect`.                      |
| **Table state** | `page`, `perPage`, `sort`, `filters`, `joinOperator`, column visibility, row selection.                                           |
| **URL state**   | The subset of table state stored in route search params: `page`, `perPage`, `sort`, `filters`, `joinOperator`.                    |
| **List input**  | The shared zod input every server-driven list procedure accepts.                                                                  |
| **Old table**   | Current `apps/web/src/shared/components/data/data-table.tsx` (`columns: {key, header, cell}`, offset pagination, no sort/filter). |

## 4. Reference summary

Facts read from the reference source.

### 4.1 Hook

`useDataTable<TData>(props)` returns `{ table, shallow, debounceMs, throttleMs }`. Props extend TanStack `TableOptions` with `pageCount` (required), `initialState` (`sorting`, `columnPinning`, …), `queryKeys`, `history`, `debounceMs` (300), `throttleMs` (50), `clearOnDefault`, `enableAdvancedFilter`. It forces `manualPagination`, `manualSorting`, `manualFiltering` and makes columns opt in to filtering via `enableColumnFilter: true`.

It uses the **TanStack Table v9 API** (`useTable`, `tableFeatures({...})`, `Subscribe`, `table.store`/`table.atoms`, `metaHelper<T>()` for typed column meta). `@tanstack/react-table@9.2.4` is the current `latest` on npm (verified 2026-09-30).

### 4.2 URL state

Keys: `page` (1-based), `perPage`, `sort` (JSON `[{id, desc}]`), `filters` (JSON `[{id, value, variant, operator, filterId}]`), `joinOperator` (`and`|`or`). In simple (non-advanced) mode each filterable column id is its own key (`status=a,b`). Parsers validate with zod and reject unknown column ids. Filter changes are debounced and reset `page` to 1.

### 4.3 Components

| File                                                                 | Role                                                                    |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `data-table.tsx`                                                     | Header/body/pagination from a `table`; `actionBar` and toolbar slots.   |
| `data-table-toolbar.tsx`                                             | Per-column filter widget chosen by `meta.variant`, reset, view options. |
| `data-table-column-header.tsx`                                       | Sort asc/desc/reset and hide column.                                    |
| `data-table-pagination.tsx`                                          | Page size select, page navigation, selected-row count.                  |
| `data-table-view-options.tsx`                                        | Column visibility popover.                                              |
| `data-table-faceted-filter.tsx`                                      | Single/multi select filter with counts from `meta.options`.             |
| `data-table-date-filter.tsx`                                         | Date and date-range filter (`Calendar`).                                |
| `data-table-slider-filter.tsx`                                       | Numeric range filter (`meta.range`, `meta.unit`).                       |
| `data-table-select-column.tsx`                                       | Checkbox selection column.                                              |
| `data-table-skeleton.tsx`                                            | Loading skeleton.                                                       |
| `data-table-filter-list.tsx` / `-filter-menu.tsx` / `-sort-list.tsx` | Advanced filter and sort builders (~2,300 lines, dnd-kit).              |

Lib: `data-table-types.ts`, `data-table-utils.ts` (`dataTableConfig` operators per variant, `getValidFilters`, `getColumnPinningStyle`), `parsers.ts` (nuqs parsers), `filter-columns.ts` (filters → Drizzle `SQL`), `export.ts` (CSV).

Quirk: the Base variant's date filter imports the Radix `calendar`; the adaptation uses `@base-template/ui/components/calendar`.

### 4.4 Not portable as-is

- nuqs (not installed here; auto-detects Next).
- Server component page, `"use cache"`, `cacheTag`, `React.use(promises)`, `<Suspense>` data flow.
- `filterColumns` imports `@/db/utils` and assumes Drizzle tables; the platform users/organizations lists now use the Drizzle adapter, the members list uses a Drizzle query too (`members.list`); only invitations still go through better-auth.
- Page/perPage + `pageCount` vs. this repo's `limit`/`offset` + `total`.

## 5. Current state (base-template)

- `packages/ui` already has `table`, `popover`, `command`, `dropdown-menu`, `select`, `checkbox`, `calendar` (react-day-picker 10.0.1), `slider`, `badge`, `separator`, `tooltip`, `skeleton`, `input`, `button`, `pagination`, `empty`. Missing: `faceted`, `sortable`, `action-bar`.
- Not installed: `@tanstack/react-table`, `nuqs`, `date-fns`, `@dnd-kit/*`.
- Old table consumers keep state in `useState` (offset only); no list route has `validateSearch`. `validateSearch` with zod schemas in feature `lib/` is the established pattern (auth routes).
- List procedures accept `limit` (1..`MAX_PAGE_SIZE` = 100, default `DEFAULT_PAGE_SIZE` = 20) and `offset`; none accept sort. Defined in `packages/auth/src/platform.ts` and `packages/auth/src/audit/queries.ts` (duplicated constants).
- Tests: `bun test` with `renderToStaticMarkup`; no DOM environment.

## 6. Design

### 6.1 Placement

```
packages/ui/src/components/
  faceted.tsx (+ .stories.tsx)            Base UI popover + command, app-agnostic
  sortable.tsx (+ .stories.tsx)           dnd-kit sortable wrapper, app-agnostic
apps/web/src/shared/
  components/data-table/
    data-table.tsx                        composition + preserved states
    data-table-toolbar.tsx
    data-table-column-header.tsx
    data-table-view-options.tsx
    data-table-faceted-filter.tsx
    data-table-date-filter.tsx
    data-table-slider-filter.tsx
    data-table-pagination.tsx
    data-table-skeleton.tsx
    data-table-action-bar.tsx
    data-table-select-column.tsx
    data-table-advanced-toolbar.tsx
    data-table-filter-list.tsx            advanced filters, drag reorder
    data-table-filter-menu.tsx            command-palette alternative
    data-table-sort-list.tsx              multi-column sort, drag reorder
    *.stories.tsx                         one per presentational component
  hooks/use-data-table.ts                 TanStack Table + router search state
  lib/data-table/
    types.ts                              column meta, variants, operators
    config.ts                             operators per variant
    search.ts                             zod schemas for URL state
    filters.ts                            getValidFilters, defaults
    pagination.ts                         page <-> offset, pageCount
packages/api/src/lib/list-input.ts        shared zod list input
packages/db/src/lib/list-query.ts         Drizzle adapter (where/orderBy/limit/offset/total)
```

Rules: `packages/ui` stays app-agnostic (no router, no oRPC). `shared/**` imports no feature. Each feature defines its columns and its route `validateSearch` schema in its own `lib/`, built from `shared/lib/data-table/search.ts`.

### 6.2 URL state

Decided (§10 decision 1): TanStack Router search params, no nuqs.

- `createDataTableSearchSchema({ columns, defaultSort, defaultPerPage })` returns a zod schema used in the route's `validateSearch`. Unknown column ids, invalid operators and out-of-range `perPage` fall back to defaults instead of throwing.
- `useDataTable` reads `Route.useSearch()` and writes with `navigate({ search, replace: true })`; text filters are debounced (300 ms) and any filter or `perPage` change resets `page` to 1.
- Default values are omitted from the URL (`clearOnDefault` behaviour).
- Column visibility and row selection stay in component state (not URL).
- Advanced mode (`enableAdvancedFilter`) is chosen per list. It stores all filters in `filters` + `joinOperator`; simple mode stores one key per filterable column. A list whose backend cannot evaluate arbitrary operators or `or` joins (better-auth lists, §6.4) stays in simple mode.

### 6.3 Data flow

```
route validateSearch ─► search ─► feature queryOptions(orpc.x.list, toListInput(search))
                                   │ keepPreviousData
                                   ▼
                     { rows, total } ─► useDataTable({ data, pageCount, columns })
                                   ▼
                     <DataTable table state={query}> toolbar | action bar
```

`toListInput` maps `page/perPage` to `limit/offset`; `pageCount = ceil(total / perPage)`. The table receives the query status so the old loading/empty/error/out-of-range behaviour is preserved.

### 6.4 Server contract

- `listInput` (zod): `page` ≥ 1, `perPage` 1..`MAX_PAGE_SIZE`, `sort: {id, desc}[]` (max 3), `filters: {id, variant, operator, value}[]`, `joinOperator`.
- Each procedure narrows `id` to an allowlist of sortable/filterable columns for its resource; unknown ids are rejected by zod, never interpolated into SQL.
- Drizzle-backed lists use the adapter (ported from `filterColumns`, without `@/db/utils` and with operators limited to `config.ts`).
- Platform users and organizations are Drizzle-backed lists (`listPlatformUsers`, `listPlatformOrganizations`); a database failure rejects so the table shows its error state. `members.list` is Drizzle-backed as well (member joined to user, scoped to the session's active organization); invitations still use better-auth (see §7).
- `MAX_PAGE_SIZE`/`DEFAULT_PAGE_SIZE` are defined once and reused.

### 6.5 Column definition example

```ts
export const usersColumns = [
  selectColumn<User>(),
  {
    id: "email",
    accessorKey: "email",
    header: ({ column }) => <DataTableColumnHeader column={column} label="Email" />,
    meta: { label: "Email", variant: "text", placeholder: "Search email…" },
    enableColumnFilter: true,
  },
  {
    id: "role",
    accessorKey: "role",
    meta: { label: "Role", variant: "multiSelect", options: roleOptions },
    enableColumnFilter: true,
  },
] satisfies DataTableColumn<User>[];
```

## 7. Migration

| Consumer                                                         | Data source                     | Target                                                      |
| ---------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------- |
| `features/admin/components/users-page.tsx`                       | `platform.users.list` (Drizzle) | search + role/status facets, multi-sort                     |
| `features/admin/components/organizations-page.tsx`               | `platform.organizations.list`   | search, sort by name/created                                |
| `features/audit-log/components/{org,platform}-activity-page.tsx` | `audit.list*` (Drizzle)         | action facet, actor, date range; first Drizzle adapter user |
| `features/invitations/components/pending-invitations-table.tsx`  | client data                     | client-side mode (no URL state) or server list              |
| `features/organizations/components/members-page.tsx`             | `members.list` (Drizzle)        | name/email search, role filter, multi-sort, pagination      |

Each migrated route gains `validateSearch`. After the last consumer moves, the old `DataTable`, `OffsetPager` and `data-table-pagination.tsx` are removed; `data-table-state.ts` and `pagination.ts` logic is kept or folded into `shared/lib/data-table/`.

## 8. Requirements

- **R1 State.** Sort, filters, page and perPage round-trip through the URL; reload and back/forward restore the same view. Invalid search params never crash a route.
- **R2 Server-driven.** Sorting, filtering and pagination are server-side; the client never sorts or filters a page of results.
- **R3 States.** Loading shows `DataTableSkeleton`; empty, error with retry, refetch error and out-of-range page recovery match current behaviour.
- **R4 Safety.** Server rejects unknown sort/filter ids and operators; no raw column name from input reaches SQL.
- **R5 Accessibility.** Headers expose `aria-sort`; filters and pagination are keyboard operable; stories pass `a11y.test = "error"`.
- **R6 Stories.** Every new `packages/ui` primitive and every presentational table component has a story; presentational components are registered in `tests/lib/app-story-registry.ts`.
- **R7 Boundaries.** Lint boundary tests pass; `packages/ui` gains no app imports.
- **R8 Attribution.** Files copied or derived from tablecn carry a header comment referencing the MIT source.

## 9. Tasks (proposed)

| ID  | Task                                                                                                                                                                            | Checks                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| T0  | Add deps (`@tanstack/react-table`, `date-fns`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`, `@dnd-kit/utilities`); `faceted` and `sortable` primitives + stories | `bun test`, `check-types`, storybook build |
| T1  | Pure logic: types, config, search schemas (simple and advanced), filters, pagination (TDD)                                                                                      | `bun test`                                 |
| T2  | `useDataTable` + simple components + stories (toolbar, headers, view options, pagination, selection, action bar, skeleton, preserved states)                                    | `bun test`, `check-types`, storybook build |
| T3  | Advanced mode: advanced toolbar, filter list, filter menu, sort list + stories                                                                                                  | `bun test`, `check-types`, storybook build |
| T4  | Server: shared `listInput` (incl. `joinOperator`), single page-size constants, Drizzle adapter + tests                                                                          | `bun test`, `check-types`                  |
| T5  | Migrate audit log (org + platform) with `validateSearch`, advanced mode enabled, CSV export of selected rows                                                                    | tests + manual smoke                       |
| T6  | Migrate admin users and organizations (better-auth subset verified, simple mode)                                                                                                | tests + manual smoke                       |
| T7  | Migrate invitations and members; remove old table                                                                                                                               | tests, lint boundaries                     |

Delivery: the forecast exceeds 400 authored changed lines; slicing per task applies under `ask-on-risk`.

## 10. Decisions

All questions were answered by the user on 2026-09-30.

1. **URL state mechanism.** **Resolved (2026-09-30):** TanStack Router `validateSearch` + `navigate` with zod schemas; `nuqs` is not added (§6.2).
2. **Old table.** **Resolved (2026-09-30):** replaced; all consumers migrate (§7) and the old `DataTable`, `OffsetPager` and `data-table-pagination.tsx` are removed in T7.
3. **Advanced filters and multi-sort.** **Resolved (2026-09-30):** included in this delivery (T3), with dnd-kit; enabled per list where the backend supports it (§6.2).
4. **Interaction tests.** **Resolved (2026-09-30):** `bun test` only: pure-logic tests and `renderToStaticMarkup` render tests; interaction is covered by Storybook stories. No DOM environment is added.
5. **First consumer.** **Resolved (2026-09-30):** audit log (org + platform), T5; validates the Drizzle adapter, advanced filters and date range end to end.
6. **Row actions / action bar.** **Resolved (2026-09-30):** selection column + generic `DataTableActionBar`; the only bulk action in this delivery is CSV export of selected rows on the audit log (read-only, no new procedures or permissions). Mutating bulk actions are out of scope.
