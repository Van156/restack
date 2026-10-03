# Restaurant

Rationale behind the restaurant domain code that does not fit in a code comment. Requirements live in [`docs/prd/restaurant-management.md`](../prd/restaurant-management.md) and the vocabulary in `GLOSSARY.md`.

Code: `packages/api/src/routers/restaurant/*`, `packages/api/src/lib/{override,pin,acting-token,device-auth,table-session}.ts`, `packages/db/src/schema/restaurant-*.ts`.

## Overrides

An Override lets a Staff member without the permission perform a guarded action (void of a sent line, discount, Bill reopen, Cash shift close with a difference) with a manager's PIN.

- `overrides.mint` checks the approver's PIN. The approver must hold `override:give` and be assigned to the Location (the Owner is exempt). The approver cannot be the requester, so nobody approves their own action. The Owner is exempt from that rule too (assumption: the Owner owns the money).
- The Override is bound to Location, action and target, expires after 5 minutes and is single use. Its id is a random UUID and doubles as the opaque token.
- `consumeOverride` spends it with one guarded `UPDATE ... WHERE` (unused, unexpired, same organization, Location, action and target). A refused attempt never burns it and two concurrent callers cannot both win.
- The caller passes its transaction. The spend and the `override.used` audit row are written through that executor, not through the `AuditLogger` port (the port has no transaction handle), so both roll back with the action they authorized.

## PINs and lockout

- A PIN is low-entropy: it is salted and slow-hashed. Wrong PIN and no PIN return the same FORBIDDEN so a PIN-less member is not distinguishable.
- Five wrong PINs in a row lock the member for 15 minutes (TOO_MANY_REQUESTS).
- Counting and locking happen in one guarded `UPDATE`, so concurrent wrong guesses cannot undercount. A lock that already ran out restarts the count at one inside the same statement. A correct PIN, a PIN reset and a PIN set clear the counter and the lock.
- The failed attempt is persisted before the call throws, so it counts although the call fails.

## Acting member

`staff.switchIn` verifies a Location member's PIN and returns an acting token: an HMAC-SHA256 over organization, Location, member and expiry (clock-injected, TTL 15 minutes, secret `BETTER_AUTH_SECRET`). Order procedures accept it as `actingToken` to record lines, voids and discounts as made by that member.

- No token: the session's member. An invalid or expired token is FORBIDDEN, never ignored.
- The member must still be assigned to the Location and hold `order:take`.
- A raw member id from input is never trusted.

## Table sessions and deletion

- At most one unsettled (`open` or `bill_requested`) session per Table, enforced by a partial unique index.
- `table_session.table_id` is `no action` toward `dining_table`: a Table that ever had a session cannot be deleted, so order and Bill history never disappears. The check runs at statement end, so deleting a whole Location still cascades.
- `areas.delete` and `tables.delete` refuse with CONFLICT for an open session (`hasOpenBillsInArea`, `hasOpenSessionAtTable`) and, through a mapped foreign-key error, for settled history.

## Paired devices

- `devices.redeem` is public. Its single guarded `UPDATE` makes a code work exactly once; only hashes of code and token are stored.
- Rate limit: 20 attempts per source (first `x-forwarded-for`, else `x-real-ip`) and 5 per code in 15 minutes, through the injectable `RateLimiter` in `Context` (in-memory, per process, on the injected clock). Without a limiter in the context nothing is throttled.
- `authenticateDevice` records `lastSeenAt`, which feeds the Location's online state. Kitchen procedures restrict Ticket access to the device's `stationIds`.

## Orders

- Order lines are append-only; a void or a send is a new row. The idempotency key is unique per organization, so a client retry returns the stored row even after the item sold out.
- A Ticket is the lines of one send that a Station prepares; deleting a Station removes its Tickets, the Order lines stay.

## Kitchen display

- Device transport: `Authorization: Device <token>`. The server context resolves it with `deviceFromHeaders` into `context.device` (unknown or revoked tokens give `null`). CORS already allows the `Authorization` header.
- Only `restaurant.kitchen.{list, advance}` read `context.device`. Every other procedure builds on `protectedProcedure`, which needs a user session, so a device-only caller is `UNAUTHORIZED` there with no per-procedure check. `kitchen.metrics` needs `report:read` and so also rejects devices.
- A device cannot name another Location or Station (`FORBIDDEN`), and a Ticket outside its Stations is `NOT_FOUND`. Staff need `order:take` and Location access; `stationId` is an optional filter.
- Preparation time is `readyAt - startedAt`, pickup wait is `deliveredAt - readyAt` and sent-to-ready time is `readyAt - sentAt` (the whole kitchen wait, queue included), each as average and maximum. Metrics are per Station for the business day the Ticket was sent.
- `kitchen.list` shows unfinished Tickets always and delivered ones for the current business day only. It carries no prices.
- Status moves one step at a time with a guarded `UPDATE ... WHERE status = <previous>`, so a double tap cannot skip a step; repeating the step just taken returns the Ticket.
- `orders.listOpenSessions` flags each session with `hasReadyTicket` (a Ticket in `listo`) for the floor-plan marker.

## Bill computation

`computeBill` (`packages/db/src/lib/bill.ts`) prices a Bill from its billable lines (those without a void) at their recorded prices.

- Discounts apply in recorded order. An amount takes `min(value, remaining)`; a percent is taken from what remains, rounded half up. The stack stops at zero, so the discount never exceeds the subtotal.
- The discount is spread over the lines in proportion to each line's total (largest remainder, earlier lines first on ties), so line discounts add up to the discount exactly.
- Tax is derived once per line from the discounted line total (`deriveTax`, half up). The tax base therefore shrinks with the discount, and `base + tax` equals the Bill total.
- The Bill total is the sum of discounted line totals. The tip is outside the tax base and is added only to the amount to pay.
- The suggested tip is the Location's percent of the Bill total, rounded half up. The tip itself is any whole-peso amount the customer chooses.

## Billing

Procedures: `packages/api/src/routers/restaurant/billing*.ts`; schema `packages/db/src/schema/restaurant-billing.ts`.

- One Bill row per Table session, created on the first tip or payment. Totals are always computed from the lines (`loadBillView`); the stored `base`, `tax`, `discountTotal` and `total` are a snapshot written at settle and cleared on reopen.
- Who may charge: `billing:charge` plus Location access. A plain Waiter also needs the Location's "waiters can charge" flag (`roleMayCharge`); Owner, Administrator and Cashier do not. With an acting token the member who switched in must meet the same rules.
- Tip: any whole-peso amount, outside the tax base and added only to what is due. It can change or be removed at any time, also after settling, without an Override; settled totals never change, only the amount due. A tip raised after settling leaves a balance that a later payment covers.
- Payments: `amount` is what the payment covers and must fit the balance due (total plus tip); `tendered` is cash only and the change is `tendered - amount`. Card and QR/transfer need a reference. Split payments are separate calls. The idempotency key is unique per organization, so a retry returns the stored payment even after settling. `clientRecordedAt` keeps the device sale time; `recordedAt` is the server clock.
- Settle needs at least one billed line and a balance of exactly zero; it settles the Table session, which frees the Table. Repeating it returns the settled Bill.
- Reopen needs an Override (`reopen_bill`, target the Table session id) with no exemptions and is audited `bill.reopened`. The session returns to `bill_requested`; it is refused while the Table has a newer unsettled session. Payments stay on the Bill.
- Buyer directory: restaurant-wide per organization, unique per document type and number. A buyer is saved only with `consent: true` (the consent time is recorded); saving the same document updates it. Procedures take a `locationId` for scope and the charge rule.

## Invoicing

Port, fake, factory and Alegra adapter: `packages/api/src/lib/invoicing/`. The port issues a document from a Bill snapshot, looks one up by idempotency key or provider reference, and reads the habilitación status. A transient failure throws `InvoicingTransientError`; a rejection is a normal result carrying the provider's reason.

- `createInvoicingProvider(env)` needs `ALEGRA_EMAIL` and `ALEGRA_TOKEN` together or not at all. In production Alegra is used when they are set. Outside production the recording fake is used unless `INVOICING_PROVIDER=alegra` is set explicitly, so credentials alone never reach the real DIAN from a dev or test run. Production refuses `INVOICING_PROVIDER=fake` at startup. Production without credentials still starts but returns a provider whose every call throws `InvoicingNotConfiguredError`, so issuing is disabled with an explicit error and nothing is ever faked.
- The recording fake keeps every call, is deterministic (number `<prefix><n>`, reference `fake-<key>`), replays by key and can be scripted to reject, fail transiently or be unreachable.
- Credentials are platform-level (env). The per-Location connection stores only the provider company reference, numbering prefix and habilitación status, never a token.

### Alegra assumptions

Verified in Alegra's reference: basic auth with email and token, `POST /invoices` on `https://api.alegra.com/api/v1`, the `stamp` object, and a 400 with an error `message` (and a draft invoice) when stamping fails. Assumed, to confirm against the sandbox with the contract test (`ALEGRA_SANDBOX_EMAIL`, `ALEGRA_SANDBOX_TOKEN`, optional `ALEGRA_SANDBOX_COMPANY` and `ALEGRA_SANDBOX_BASE_URL`; skipped when absent):

- Inline items (`name`, `quantity`, `price`, `tax`) instead of Alegra item ids, `numberTemplate.prefix` selecting the numbering, and `company` carrying the associated company.
- Integer COP: `price` is `base / quantity` only when that is a whole number; otherwise the line goes as quantity 1 at the line base with `x<quantity>` in the name, so the provider reproduces the base exactly. The line tax is sent as `tax: [{ name: <taxClass>, amount: <our tax> }]` so the provider total matches our Bill; that it honours an explicit amount (instead of recomputing from a rate) is unconfirmed.
- The document kind travels as `documentType`: `POS` for the POS equivalent, `INVOICE` for a factura, on the same endpoint. The field name, its values and the POS equivalent's availability for associated companies are unconfirmed. The numbering prefix is one per connection and does not vary by kind.
- No native idempotency key: the key travels in `observations` as `restack:<key>`. `issueDocument` first searches `GET /invoices?query=` and returns the invoice already carrying that exact key (the search is textual, so `doc-1` also hits `doc-10` and only an exact match counts); a POST that timed out after creating the invoice is therefore never repeated. A draft left by a failed stamp has no `stamp` and is not found, so a retry creates a new one. The database unique per Bill and kind is the other guarantee.
- Response fields `stamp.cufe`, `stamp.barCodeContent`, `numberTemplate.fullNumber`; habilitación from `GET /company` `electronicInvoicing.status`.
- HTTP 5xx, 429, 408 and network failures are transient; other 4xx are rejections.

### Documents

`dian.issueDocument` (`routers/restaurant/dian-documents.ts`, core in `lib/invoicing/`) issues the document of a settled Bill.

- Unique per Bill and kind. The request takes the Bill lock, so concurrent or repeated calls return the same row and the provider is called once. A second kind is refused (`CONFLICT`) while the Bill holds a document that is not rejected, so one sale never yields both a POS document and a factura.
- Gate order: settled Bill, DIAN on for the Location (off returns the exempt receipt text "Este documento no es una factura electrónica" and stores nothing), Plan (Completo or an active trial), an enabled connection, then the provider.
- The default kind is the POS equivalent; a factura needs a buyer from the directory. No buyer means consumidor final, returned with a note that it gives the buyer no deduction.
- The payload is a snapshot of the Bill at request time (lines with base and tax, tip as a separate line, buyer, sale time). A tip changed later never touches it. Sale time is the Bill's `settled_at` (see [Sync](#sync)).
- A rejection is stored with the provider's reason. `retryDocument` returns it to pending (a factura may take a corrected buyer) and the provider key gains an `:r<n>` suffix so the retry is a new submission.

### Outbox and incidents

Every document has one outbox row. `transmitDocument` makes one attempt; `drainOutbox` retries every due row and is what the job runs.

- Backoff doubles from one minute to an hour. The 48 hour deadline counts from when the request reached the server (connectivity recovered), the reading of Res. 165 art. 37 for synced offline sales. A drain flags a row `overdue` once past it and keeps retrying.
- A transient failure keeps the document pending and opens the Location's incident (`provider_unavailable`). A contingency request opens one too (`offline_sale`, started at the sale time). At most one incident is open per Location (partial unique index); each issued document counts in `documentsCovered` and the incident closes when no pending outbox row is left.
- Only the provider's answer settles a document (guarded `UPDATE ... WHERE status = 'pending'`), so two racing attempts count it once. The monthly counter (Bogota month of issue) is incremented in that same transaction. There is no hard stop at the fair-use ceiling.
- `startInvoicingOutboxJob` drains once at start and then each interval, skips overlapping ticks, reports failures and keeps running. Each replica runs its own timer; the guarded update and the provider key make overlap harmless.

## Cash shift

Procedures: `packages/api/src/routers/restaurant/cash-shift*.ts` (`appRouter.restaurant.cashShift`); ledger math in `packages/api/src/lib/cash-shift.ts`; schema `packages/db/src/schema/restaurant-cash-shift.ts`. All need `cashShift:manage` (Owner, Administrator, Cashier) plus Location access; the Waiter is denied.

- One open shift per Location, enforced by a partial unique index (`closed_at IS NULL`); a second open is CONFLICT, also under concurrency.
- `recordPayment` attaches the payment to the Location's open shift (`payment.cash_shift_id`), reading it with a shared row lock so `close`, which locks the shift for update, waits for in-flight payments and counts them.
- No open shift: the payment is still recorded, with a null `cash_shift_id` (blocking would stop sales and offline sync on a forgotten open). User decision: the next shift opened at that Location takes it. `open` attaches every shiftless payment of the Location in its own transaction (count in the `cash_shift.opened` audit), so they show in that shift's ledger and close, however old they are. A payment racing the open can miss it and then waits for the following shift.
- Ledger: per tender the sum and count of payment `amount` (what the payment covered, so cash change is already out). `changeGiven` is the sum of `tendered - amount` and is informational. Expected cash is opening amount plus cash takings; card and QR/transfer expect their takings. The tip is part of the payment amounts; the `tips` figure is informational: each Bill's tip counts once, in the shift of its latest payment.
- Close takes counted amounts for all three tenders. The stored `difference` is `counted - expected` over the totals (negative is a shortage), but an Override is needed when any single tender differs, so a cash shortage cannot hide behind a card surplus. The Override (`close_shift_difference`, target the shift id) is spent in the same transaction; a refused close spends nothing. Audit: `cash_shift.closed` or `cash_shift.closed_with_difference` with expected, counted, difference and the approver.
- Offline takings: payments of the shift with `registered_offline`, ordered by recording time.

## Tip distribution

Procedures: `cash-shift-tip-beneficiaries.ts` and `cash-shift-tip-distribution.ts`; computation in `lib/tip-distribution.ts`; split math in `packages/db/src/lib/tip-split.ts` (`splitTips`). Ley 1935 de 2018 is the product reason; the defaults below are product decisions to confirm.

- Beneficiaries belong to a Cash shift, as a Staff member (assigned to the shift's Location) or a person added by name. The Owner and Administrators are rejected (`BAD_REQUEST`), checked on every role of the member. `tipCandidates` lists the Location's default candidates: assigned Staff minus those two Roles.
- Configuring needs `setup:manage` (Owner and Administrator), following the spec's "Owner configures" story widened to the Administrator who covers for the Owner; the Cashier only distributes (`cashShift:manage`). The list is replaced as a whole and frozen once the shift is distributed (which normally happens at close).
- Split: equal when no entry has a percent; otherwise every entry has a whole percent (1 to 100) and they add up to 100. Mixed or non-100 lists are `BAD_REQUEST`.
- Remainder rule (whole COP): each share is the floor of its exact amount; leftover pesos go one each to the largest fractional remainder, ties to the earlier beneficiary in list order. Equal splits therefore hand the extra pesos to the first beneficiaries, and shares always sum to the tip total.
- The tip total is `shiftTipTotal` (see Cash shift). `cashShift.close` computes and stores the distribution in its own transaction (one row per beneficiary with a name snapshot, `tip.distributed` audited there). It is a snapshot of the close: a tip changed afterwards never rewrites it and there is no refund or redistribution path (the spec asks for none). A shift with no tips distributes zeros.
- Default beneficiaries (assumption: the spec names "waiters and kitchen staff" but has no kitchen Role): a shift with no eligible configured beneficiary uses the Location's default group, stored as its list: assigned Staff holding the `waiter` Role, plus other assigned Staff who are not Owner or Administrator and whose Roles carry no `billing:charge` permission (in practice the plain `member` Role, such as kitchen staff). Cashiers charge, so they are in only if they also hold `waiter`. An unknown custom Role counts as having no charge permission. The default group splits equally.
- The exclusion is re-checked at distribution: a configured member who became Owner or Administrator since is dropped from the list, and agreed percents of the rest keep their proportions and are rescaled to 100 (largest remainder). If nobody is left, the default group applies.
- If nobody is eligible even then, close still succeeds and stores nothing (no audit). `distributeTips` (`cashShift:manage`, closed shift) then computes it once beneficiaries are configured (`setTipBeneficiaries` stays open while nothing is distributed); with a stored distribution it just returns it, with no second audit event. It returns `PRECONDITION_FAILED` while nobody is eligible.
- Report: `tipDistributionReport` takes a shift, or `from` and `to` Bogota business days (inclusive) for shifts closed in that period. Only distributed shifts appear; each person is summed across them (by member, or by name for people without an account).

## Plans and trial

Procedures: `packages/api/src/routers/restaurant/plan.ts` (`appRouter.restaurant.plan`); pure helpers in `packages/api/src/lib/plan.ts`. Every procedure needs `subscription:manage` (Owner only), so the Administrator is denied.

- Plan (`esencial`, `completo`) and trial end are fields on the Location. `plan.list` returns both per Location with the derived trial state (`none`, `active`, `expired`, started days left) and `dianAllowed` (`planAllowsDian`, the same gate the issuing path uses). Trial state is computed from the stored end and the injected clock; nothing is written when a trial lapses.
- `plan.set` changes one Location's Plan and audits `plan.changed` (previous and new Plan) in the same transaction. Setting the current Plan again changes and audits nothing. It never touches the trial end: an Esencial Location keeps DIAN until its trial ends.
- `plan.documentCounts` reads `dian_document_counter` (Bogota month, default the current one) per Location, zero when no document was issued. `overFairUse` is true above 5.000; it is information for the platform operator, never a stop.

## Reports

Procedures: `packages/api/src/routers/restaurant/reports.ts` (`appRouter.restaurant.reports`); aggregation in `packages/api/src/lib/sales-report.ts` (pure), data loading in `lib/sales-report-data.ts`. Every procedure needs `report:read` (Owner and Administrator; Cashier and Waiter are denied) plus Location scope.

- Scope: an optional `locationId` filters to one Location (`assertLocationAccess`); without it the report covers `accessibleLocationIds`, so the Owner gets the all-Locations view and an Administrator only the assigned Locations. Results carry a `byLocation` breakdown next to the totals.
- Day: a Bogota business day (`date`, default today by the injected clock; malformed is `BAD_REQUEST`). Sales belong to the day the Bill **settled** (`bill.settled_at`, which is the sale time for offline sales), so a late-night sale stays on its date and a reopened Bill leaves the report until it settles again. An offline sale counts on the day of the sale: settling stores the original sale time as `settled_at` (see [Sync](#sync)).
- `daily`: per tender the count and amount of payments of the day's settled Bills (`collectedTotal` includes tips because payments cover total plus tip), `salesTotal` (Bill totals, tip excluded) and `tipTotal` apart, and the DIAN documents with a sale time in the day by status and kind. Amounts are the recorded ones: Bill totals and payment amounts, never recomputed from the menu.
- `kitchen`: the `kitchen.metrics` summary (`summarize` in `kitchen-metrics.ts`, shared) over Tickets sent that day, per Location and in total; the per-Station view stays in `kitchen.metrics`.
- `byItem`: per Menu item the quantity, `revenue`, `cost` and `margin` of the day's settled Bills, best revenue first, plus a `total` margin summary. Lines come from unvoided Order lines at their recorded prices; `revenue` is the line total after its share of the Bill discount (`computeBill`), so item revenues add up to the Bill totals. Modifiers are part of the line revenue and carry no cost.
- Cost is the Menu item's **current** `cost` (Order lines hold no cost snapshot), so editing a cost restates past days. A line without a cost (no cost set, or the Menu item deleted: its recorded name is kept, grouped by name) is flagged (`costMissing`, `marginIncomplete`) and left out of the margin: `margin` is `costedRevenue - cost`, `uncostedRevenue` shows what it excludes, and margin is null when nothing is costed. A cost of 0 is a real cost.
- `byStaff`: per Staff member who **settled** the Bill (`bill.settled_by_member_id`, the member the charge is attributed to), with Bill count, sales, tips and the same margin summary; the name comes from the member's user.

## Sync

Procedure: `restaurant.sync.push` (`routers/restaurant/sync.ts`; sessions in `sync-sessions.ts`, Table metadata in `sync-table-metadata.ts`, last-write-wins helpers in `sync-lww.ts`, statuses and notes in `sync-results.ts`). It applies the records a device queued while offline and answers one result per record, in order: `applied`, `already_applied` or `rejected` with `reason: { code, message, data }`. It runs the same cores as the online procedures (`addLineCore`, `voidLineCore`, `recordPaymentCore`, `settleCore`, `issueDocumentCore`), so no business rule is duplicated.

- Record: `{ idempotencyKey, kind, payload, deviceRecordedAt, actingToken? }`. Kinds: `open_session`, `move_session`, `order_line`, `void`, `payment`, `takings`, `table_metadata`, `document_request`. A batch holds 1 to 200 records.
- Independence: records are processed in order, each in its own transaction (a document request and a void run their own steps instead, because they call the provider or write audit after commit). A rejection leaves nothing of that record behind and never stops or undoes the others. A malformed payload or unknown kind is a rejection of that record. An error that is not a business rejection (database down) fails the whole call; the client retries the batch and applied records come back as `already_applied`.
- Authority: each record checks its own permission (`order:take` for sessions, lines and voids, `billing:charge`, `setup:manage`) and Location scope, so a Waiter's batch applies the lines and rejects the payments. An acting token travels per record. Its signature and bindings (organization, Location, member still assigned) are checked at sync time, but its expiry is checked at the record's `deviceRecordedAt` (clamped to the server clock), so a record made inside the 15 minute life of a token is attributed to that member however late it syncs. User decision: only records within 48 hours before arrival qualify (`MAX_OFFLINE_TOKEN_AGE_MS`); an older record or one made after the token expired is `FORBIDDEN`. Online calls keep checking at the server's now.
- Idempotency: order line, void and payment keys are the existing unique indexes per organization; a key reused for another session or line is a `CONFLICT` rejection. `already_applied` always comes from the write path of the core (unique key with `ON CONFLICT`, the Bill lock, the document unique per Bill and kind, the Table or session row lock), never from a probe before it, so two concurrent replays report one `applied` and one `already_applied`. A document request replays by Bill and kind, whatever its key.
- Recorded prices win: an order line carries `unitPrice` and the chosen modifiers with `priceDelta`, stored as given, never recomputed from the Menu. The sold-out and inactive guards are skipped for synced lines (the line was taken before the server knew); a deleted Menu item still rejects.
- Table sessions opened offline: an `open_session` record `{ tableId }` opens a session at `deviceRecordedAt` for the acting member (`order:take`). Its idempotency key is the **session key**: later records (`order_line`, `move_session`, `payment`, `takings`, `document_request`) name the session by `tableSessionId` (a server id) or `sessionKey` (exactly one), resolved server-side through `table_session_key`, in the same batch or a later one. An unknown key is a retryable `NOT_FOUND` rejection with `data.reason = "session_not_synced"`; the client keeps the record pending until the opening record syncs.
- Opening a Table that already has an open session merges: the record is `applied` with `note: "merged"` and `entityId` of the existing session, and the key names it from then on, so two devices that opened the same Table offline share one session and no line is lost or rejected. Assumption (no spec rule; the alternative of rejecting would strand the lines recorded under the key): the Table is one party at a time. A Table whose earlier session settled opens a new one. Replaying the opening key is `already_applied`.
- Moves: `move_session` `{ tableSessionId | sessionKey, tableId }` (`order:take`, same Location, unsettled session). Last-write-wins by device time with the same tie-break as Table metadata (greater key), over `table_session.table_moved_at` and `table_move_key`; an online `moveSession` stamps the server time and takes part in the ordering. A losing move is `applied` with `note: "superseded"`; an occupied target Table is a `CONFLICT` rejection. Renaming and re-seating Tables stays `table_metadata` with `setup:manage` (assumption: story 113 "renames and moves" is met by moving sessions; Waiters do not edit Tables).
- Voids name the line by `lineId` or by `lineKey`, the key the line was recorded with (the device does not know server ids of lines it created offline). A void of a sent line is applied only when it carries a valid Override presented at sync time; otherwise it is rejected with `data.reason = "override_required"` (or `override_invalid`, which spends nothing) and the client keeps it pending.
- Payments and takings share one payload. `takings` always sets `registeredOffline`; `payment` honours the flag. `deviceRecordedAt` becomes `clientRecordedAt`. With `settle: true` the Bill settles in the same transaction, and a balance left over rejects the whole record. The payment attaches to the open Cash shift or, with none open, to the next shift opened (see Cash shift).
- Original sale time: `deviceRecordedAt` is clamped to the server clock (a device clock ahead cannot post-date a sale). The sale time stored in `bill.settled_at` and `table_session.settled_at` (`settleTimeOf`) is the time of the payment that completed the Bill: the latest payment by effective time (`clientRecordedAt ?? recordedAt`), clamped to the server clock, whatever the mix of online and offline payments and the order they synced in (a Bill settled online follows the same rule, so it settles at its last payment). The DIAN document takes the Bill's `settled_at`. Reports, the Activated Location metric and the document therefore agree on the day of the sale; the server arrival time stays in `payment.recorded_at`. Chosen over a separate sale-time column because every reader of `settled_at` is already about the sale day.
- Table metadata (name, seats, Area) is last-write-wins by device time over the whole record: `dining_table.metadata_written_at` and `metadata_write_key` hold the winning write. A tie on time goes to the greater idempotency key, so the outcome does not depend on arrival order and a replay is harmless. A losing write is `applied` with `note: "superseded"` the first time; replaying the winner, an overtaken winner or a loser is `already_applied` (a loser's key is kept in `sync_superseded_write`, as is the key of a write overtaken by a newer sync or online write). An online `tables.update` stamps the server time, so it takes part in the ordering. Needs `setup:manage` like the online procedure. Session moves use the same ordering and the same key log.
- Document requests need a settled Bill (otherwise `CONFLICT`), default to `contingency: true`, and follow `issueDocument` (DIAN off returns the exempt receipt with `note: "exempt_receipt"`). The payload carries the original sale time. The 48 hour deadline counts from the server's receipt (see Outbox and incidents); the server never rejects a late sale, the client blocks contingency sales after 48 hours offline.

## Product health

Procedures: `packages/api/src/routers/platform-health.ts`, mounted as `appRouter.platform.health`; pure rules in `packages/api/src/lib/product-health.ts`. Both are `platformProcedure({ health: ["read"] })`: only a platform superadmin holds `health:read`, an organization Owner does not (R6.5). They span every organization and Location.

- Weekly Active Location (north star, PRD section 9): a Location that closed a Cash shift (`cash_shift.closed_at`) on 5 or more distinct Bogota business days of the week. The week is Monday to Sunday (`weekOf`; the PRD does not name the first day), selected by any `date` in it, default today by the injected clock. Several closes on one day count once; open shifts do not count. `weeklyActive` lists the Locations with at least one close day, flagged `active` at 5 or more, and `activeCount`.
- Activated Location (PRD section 9): within 7 days of signup it finished guided setup, settled at least 20 Bills and closed a Cash shift. Signup is the Location's `created_at`; the window is `[created_at, created_at + 7 days)`. Settled Bills are `bill.status = 'settled'` with `settled_at` in the window (a reopened Bill does not count); the close is a Cash shift with `closed_at` in the window.
- Setup finished has no stored marker (the wizard is a later UI task), so it is derived: by the end of the window the Location has a Table, a Station and an active Menu item routed to a Station there (`station_routing.created_at` in the window). Setup review warnings are not required to be zero.
- Status: `activated` once all criteria hold (even before day 7), `pending` while the window runs without them, `not_activated` after it. `activationRate` is activated over activated plus not activated, so Locations still inside their window do not drag it down; null for an empty cohort. The cohort is every Location, or those that signed up between the optional `from` and `to` business days.
