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
