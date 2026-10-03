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
- Preparation time is `readyAt - startedAt` and pickup wait is `deliveredAt - readyAt`, as in the spec. Metrics are per Station for the business day the Ticket was sent.
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

- `createInvoicingProvider(env)` picks Alegra when `ALEGRA_EMAIL` and `ALEGRA_TOKEN` are set (both or neither) and the recording fake outside production otherwise. Production refuses `INVOICING_PROVIDER=fake` at startup. Production without credentials still starts but returns a provider whose every call throws `InvoicingNotConfiguredError`, so issuing is disabled with an explicit error and nothing is ever faked.
- The recording fake keeps every call, is deterministic (number `<prefix><n>`, reference `fake-<key>`), replays by key and can be scripted to reject, fail transiently or be unreachable.
- Credentials are platform-level (env). The per-Location connection stores only the provider company reference, numbering prefix and habilitación status, never a token.

### Alegra assumptions

Verified in Alegra's reference: basic auth with email and token, `POST /invoices` on `https://api.alegra.com/api/v1`, the `stamp` object, and a 400 with an error `message` (and a draft invoice) when stamping fails. Assumed, to confirm against the sandbox with the contract test (`ALEGRA_SANDBOX_EMAIL`, `ALEGRA_SANDBOX_TOKEN`, optional `ALEGRA_SANDBOX_COMPANY` and `ALEGRA_SANDBOX_BASE_URL`; skipped when absent):

- Inline items (`name`, `quantity`, `price`) instead of Alegra item ids, `numberTemplate.prefix` selecting the numbering, and `company` carrying the associated company.
- The POS equivalent document goes through the same endpoint; its availability for associated companies is unconfirmed.
- No native idempotency key: the key travels in `observations` as `restack:<key>` and `findDocument` searches `GET /invoices?query=`. The database unique per Bill and kind is the real guarantee.
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
