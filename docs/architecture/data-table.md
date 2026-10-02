# Data table

How lists are filtered, sorted and paged, from the URL to the SQL. Requirements and design decisions live in [`docs/specs/data-table.md`](../specs/data-table.md); this page explains the code. The audit log is the main consumer: see [audit-log.md](./audit-log.md).

## Client

Code: `apps/web/src/shared/lib/data-table/*`, `shared/hooks/use-data-table.ts`, `use-filter-draft.ts`, `use-local-table-search.ts`. The pure modules (`search`, `table-state`, `advanced`, `filter-draft`, `range`, `client-list`, ...) import no React and no TanStack, so they are unit-tested directly. The hooks only wire them to effects.

### URL search shape

The table state lives in TanStack Router search params (no nuqs). `createDataTableSearchSchema` is the route's `validateSearch`.

| Key                       | Meaning                                                                   |
| ------------------------- | ------------------------------------------------------------------------- |
| `page`, `perPage`         | 1-based page and page size. Defaults are left out of the URL.             |
| `sort`                    | `[{ "id": "name", "desc": true }]`, at most `MAX_SORT_ITEMS` (3), unique. |
| `filters`, `joinOperator` | Advanced mode: complete filters and `and`/`or`.                           |
| one key per column id     | Simple mode: `role=admin,user`. Lists and ranges are comma-separated.     |

The router JSON-stringifies object and array values and JSON-parses string values that look like JSON (TanStack Router 1.171 `defaultParseSearch` and `defaultStringifySearch`). So `sort` and `filters` appear percent-encoded and arrive as real arrays, plain strings pass through (`role=admin,user`), numbers arrive as numbers, and a numeric-looking string is re-quoted on write (`name="123"`) to round-trip. The schema still accepts a JSON string for `sort` and `filters` (a hand-typed URL).

Rules:

- Validation never throws. Every key falls back to its default: a bad `page`, `perPage` or `joinOperator` uses the default, `sort` and `filters` drop unknown ids, invalid operators and incomplete items (an empty result reverts `sort` to `defaultSort`), and unknown keys are stripped.
- A column id may not reuse a reserved key (`page`, `perPage`, `sort`, `filters`, `joinOperator`); the schema throws at construction.
- `serializeDataTableSearch` omits every default so a pristine table has a clean URL (`clearOnDefault`). An empty `sort` is kept when the default is not empty: it means "unsorted".
- `mergeTableSearch` replaces only the keys the table owns and keeps other concerns (a tab, a redirect).
- `resetPageOnFilterChange` sends the table to page 1 when a patch changes the result set (any filter, `joinOperator`, `perPage`). Sort and page patches keep the page, and an explicit `page` wins.
- `toListInput` (`list-input.ts`) turns the validated search into the server input and drops anything the server would reject, caps `filters` and `sort`, and clamps `page` to the deepest page. An old or hand-edited URL degrades to a valid request instead of a 400.

### Hook contract

`useDataTable({ data, columns, pageCount, search, searchConfig, onSearchChange })` is TanStack Table in manual mode (`manualSorting`, `manualFiltering`, `manualPagination`). The server sorts, filters and pages, so no client row models are registered.

- The hook is router-agnostic. `search` is the validated route search and `onSearchChange(next, { replace })` receives the complete next search with defaults omitted. A feature passes `navigate({ search, replace })`.
- Sorting, page, page size and per-column filters are read from `search`. Column visibility and row selection stay in table state, not the URL.
- Row selection belongs to one page of results and is cleared when the query key (page, sort, filters) changes (`selection.ts`).
- Writes go through one `commit` that reads the latest search from a ref, so callbacks stay stable.
- Page size changes patch `perPage` only. TanStack recomputes the page index, but the URL contract sends the user to page 1.
- The default sort is the sort list's reset target (`initialState.sorting`).

### Simple and advanced modes

The mode is chosen per list (`enableAdvancedFilter`).

- **Simple**: one URL key per filterable column (`enableColumnFilter: true`, variant from `meta.variant`, default `text`). The URL holds the committed value and the hook holds a `pending` value while the user types. Typing in a text, number or range filter is debounced (default 300 ms). Clearing a filter or Reset writes at once. A list whose backend cannot evaluate arbitrary operators or `or` joins stays simple (spec §6.4).
- **Advanced**: `filters` plus `joinOperator` live in the URL and are edited through `advanced` (`setFilters`, `setJoinOperator`, `reset`). Only complete filters reach the URL (`isFilterValid`), so an unfinished row neither appears in the URL nor resets the page. `useFilterDraft` keeps the builder's own rows, including unfinished ones, and its transitions are the pure `reduceFilterDraft` (typing debounced, picks immediate, `clear` resets filters and join in one write).
- `isRelativeToToday` is hidden from the builders: its value has no defined meaning in the URL or on the server yet.

Both modes use `reconcileExternalSearch`. The table remembers the key of what it last committed or saw. A search with another key came from outside (back/forward, a link): it replaces any pending local value and cancels the debounced write. The echo of the table's own commit carries the recorded key and is not external.

### Dates and ranges

Dates are sent to the server as local-midnight epoch milliseconds; see [Dates and time zones](#dates-and-time-zones). Range inputs commit on blur or Enter. Typing is not validated per keystroke, so `1` on the way to `100` stays a valid draft. A commit clamps to the bounds and the other end, a blank or non-numeric draft reverts, and Enter followed by blur writes once because the second commit finds no draft. `normalizeBetweenRange` orders two ends only when both are numeric; an incomplete filter keeps what was typed.

### Client-side lists

A list whose backend returns everything (better-auth `list-invitations` takes no paging, sort or filter) uses the same table with `applyClientList` instead of a server query: filter (AND), then sort (stable, source order breaks ties), then page. `total` counts the filtered rows, so paging and out-of-range recovery behave like a server list. Columns without an accessor and filters the list cannot evaluate are ignored, and the input is not mutated. The search lives in component state through `useLocalTableSearch`, not the URL. The state it holds is the schema's normalized output, so the same `validateSearch` schema applies.

### Table states and export

- `data-table-state.ts` picks the body. Only a failure with nothing to show replaces the table with the error panel. A failed background refetch keeps the cached rows and shows an inline notice. An empty page past the first while `total > 0` is `out-of-range`: offer "last page", or the first page when the computed last page is not behind the current one (a stale total).
- CSV export (`csv.ts`) follows RFC 4180 and prefixes a text cell starting with `=`, `+`, `-`, `@`, tab or CR with `'` so a spreadsheet shows it as text instead of evaluating a formula. Real numbers are left alone.

## Server list queries

Code: `packages/db/src/lib/{list-vocabulary,list-values,list-query,pagination}.ts` (the Drizzle adapter), `packages/api/src/lib/list-input.ts` (validation) and the `*-list-config.ts` allowlists next to it.

Three layers share one vocabulary so that what validation accepts is exactly what the adapter evaluates:

- `list-vocabulary.ts` and `list-values.ts` are pure data and parsing (no drizzle, pg or zod import), so the browser bundles them too. The vocabulary lists the variants, operators and the operators each variant supports. The server evaluates every operator except `isRelativeToToday`, whose value has no defined shape yet.
- `createListInput` (`@base-template/api`) validates a client request against an allowlist. Unknown ids and operators are rejected by zod and never interpolated. Each filter must declare the column's variant, an operator that variant supports, and a value of the shape `isValueValid` expects.
- `buildListQuery` and `countListRows` (`@base-template/db`) turn the parsed input into `where`, `orderBy`, `limit`, `offset` and a total.

### Column ids reach SQL only through a map

A list passes a `ListColumns` map (id to Drizzle column). `getColumn` uses `Object.hasOwn` and throws on an unknown id, so `__proto__` or `constructor` cannot resolve to anything. The same map resolves sort ids.

### Paging

- `DEFAULT_PAGE_SIZE` 20, `MAX_PAGE_SIZE` 100.
- `MAX_OFFSET` bounds the deepest offset so a client cannot force an unbounded `OFFSET` scan. `createListInput` rejects a page beyond `getMaxPage(perPage)`.
- The page-size constants live in `@base-template/db`, the lowest package both `auth` (query clamping) and `api` (input validation) depend on, so the two cannot drift.
- `tieBreakers` (for example the primary key) are appended to `orderBy` so paging stays deterministic when sorted values tie.

### Value parsing

- Numbers: only plain decimals (optional `-`, digits, optional fraction). Hex, octal and binary literals, exponents (`1e300`), a leading `+`, surrounding whitespace and anything beyond the safe integer range are rejected, because `Number()` would accept them and Postgres would then fail at query time. `integer` also rejects fractions. A column narrower than 53 bits (`integer`) can still overflow in Postgres, so the safe-integer bound is only the portable limit.
- Text: `escapeLikePattern` escapes `\`, `%` and `_` so the value matches as a literal substring (Postgres' default `LIKE` escape is `\`). `iLike` and `notILike` wrap it in `%...%`.
- Boolean: exactly `"true"` or `"false"`.
- Lists (`inArray`, `notInArray`): `asList` throws on an empty list, and validation requires a non-empty array, so the adapter never builds an empty `IN ()`.
- `select`/`multiSelect` columns may declare `options`. An omitted list accepts any string; an empty list is a configuration error. An empty allowlist (no sortable columns, for example) rejects everything.

### Empty checks per variant

`isEmpty` and `isNotEmpty` depend on the column variant (`isEmptyCondition`):

| Variant                   | `isEmpty` matches                                 |
| ------------------------- | ------------------------------------------------- |
| `text`, `select`          | `NULL` or `''`                                    |
| `multiSelect`             | `NULL`, `''`, `'[]'` or `'{}'` (text-cast column) |
| `number`, `date`, `other` | `NULL`                                            |

`isNotEmpty` is the negation of the same condition.

### Dates and time zones

The browser sends a date filter as the epoch ms of the **local midnight** of the picked day. A filter on day D therefore covers the half-open window `[D, D + 24h)` (`DAY_MS` is a fixed 86,400,000 ms, so on a daylight-saving change day the window is an hour off from the wall-clock day):

| Operator    | Condition                          |
| ----------- | ---------------------------------- |
| `eq`        | `>= D` and `< D + 24h`             |
| `ne`        | `< D` or `>= D + 24h`              |
| `lt`        | `< D`                              |
| `lte`       | `< D + 24h` (the whole day counts) |
| `gt`        | `>= D + 24h`                       |
| `gte`       | `>= D`                             |
| `isBetween` | `>= from` and `< to + 24h`         |

The comparison is on a Postgres `timestamp` without time zone, written from JS `Date` values. `parseEpochValue` bounds the epoch to `0001-01-01` through `9999-12-30` (UTC, `MIN_EPOCH_MS`..`MAX_EPOCH_MS`). Inside it `new Date(start + DAY_MS)` is always a valid Date that Postgres accepts. The JS Date range reaches years Postgres' ISO parsing rejects, a start at the JS maximum plus one day would be invalid, and a window never crosses into year 10000.

### Joining and totals

`buildListWhere` joins the filter conditions with `and` or `or`. Callers that add a mandatory condition (tenant scope) AND it with the result, and the filters' `or` is already parenthesized, so no filter combination can widen it. `countListRows` counts the same `where`, ignoring limit and offset. See [audit-log.md](./audit-log.md#reads) for why the total is exact.

### Test double

`fakeListDb` (`packages/auth/src/fake-list-db.ts`) fakes the `select()` chain so list queries are unit-tested without a database. `where` returns the count query's promise extended with the page query's chain, so both shapes work. The count promise is marked handled because the page query never awaits it.
