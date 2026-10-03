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
- The payload is a snapshot of the Bill at request time (lines with base and tax, tip as a separate line, buyer, sale time). A tip changed later never touches it. Sale time is the latest `payment.clientRecordedAt ?? recordedAt`.
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

Procedures: `cash-shift-tips.ts`; split math in `packages/db/src/lib/tip-split.ts` (`splitTips`). Ley 1935 de 2018 is the product reason; the defaults below are product decisions to confirm.

- Beneficiaries belong to a Cash shift, as a Staff member (assigned to the shift's Location) or a person added by name. The Owner and Administrators are rejected (`BAD_REQUEST`), checked on every role of the member. `tipCandidates` lists the Location's default candidates: assigned Staff minus those two Roles.
- Configuring needs `setup:manage` (Owner and Administrator), following the spec's "Owner configures" story widened to the Administrator who covers for the Owner; the Cashier only distributes (`cashShift:manage`). The list is replaced as a whole and frozen once the shift is distributed.
- Split: equal when no entry has a percent; otherwise every entry has a whole percent (1 to 100) and they add up to 100. Mixed or non-100 lists are `BAD_REQUEST`.
- Remainder rule (whole COP): each share is the floor of its exact amount; leftover pesos go one each to the largest fractional remainder, ties to the earlier beneficiary in list order. Equal splits therefore hand the extra pesos to the first beneficiaries, and shares always sum to the tip total.
- The tip total is `shiftTipTotal` (see Cash shift). `distributeTips` needs a closed shift and at least one beneficiary, writes one row per beneficiary with a name snapshot, audits `tip.distributed` in the same transaction, and is idempotent: a repeat returns the stored rows without a second audit event. A shift with no tips distributes zeros.
- Report: `tipDistributionReport` takes a shift, or `from` and `to` Bogota business days (inclusive) for shifts closed in that period. Only distributed shifts appear; each person is summed across them (by member, or by name for people without an account).
