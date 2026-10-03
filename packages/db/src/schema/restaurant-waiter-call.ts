import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, unique } from "drizzle-orm/pg-core";

import { member, organization } from "./auth";
import { location } from "./restaurant";
import { tableSession } from "./restaurant-orders";

/** Why a guest calls the Waiter; the page labels are in `lib/waiter-call-guest.ts`. */
export const WAITER_CALL_REASONS = ["need_something", "cutlery_napkins", "pay"] as const;
export type WaiterCallReason = (typeof WAITER_CALL_REASONS)[number];
export const waiterCallReason = pgEnum("waiter_call_reason", WAITER_CALL_REASONS);

/** A call is `open` until a Waiter answers "Voy" (`on_the_way`) and then "Atendido" (`attended`). */
export const WAITER_CALL_STATUSES = ["open", "on_the_way", "attended"] as const;
export type WaiterCallStatus = (typeof WAITER_CALL_STATUSES)[number];
export const waiterCallStatus = pgEnum("waiter_call_status", WAITER_CALL_STATUSES);

/**
 * When a Staff member's client last polled a Location's floor plan or calls list; one row per
 * member and Location. Feeds the Location online state (docs/architecture/restaurant.md#waiter-call).
 */
export const staffPresence = pgTable(
  "staff_presence",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    lastSeenAt: timestamp("last_seen_at").notNull(),
  },
  (table) => [
    unique("staffPresence_member_location_unique").on(table.memberId, table.locationId),
    index("staffPresence_locationId_idx").on(table.locationId),
  ],
);

/**
 * A guest's call for a Waiter at a Table session. At most one unfinished call per guest and
 * session (partial unique index); `cooldown_until` holds the pause after it was attended.
 */
export const waiterCall = pgTable(
  "waiter_call",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "cascade" }),
    tableSessionId: text("table_session_id")
      .notNull()
      .references(() => tableSession.id, { onDelete: "cascade" }),
    reason: waiterCallReason("reason").notNull(),
    status: waiterCallStatus("status").default("open").notNull(),
    createdAt: timestamp("created_at").notNull(),
    acknowledgedAt: timestamp("acknowledged_at"),
    acknowledgedByMemberId: text("acknowledged_by_member_id").references(() => member.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at"),
    resolvedByMemberId: text("resolved_by_member_id").references(() => member.id, {
      onDelete: "set null",
    }),
    cooldownUntil: timestamp("cooldown_until"),
    /** Opaque hash of the guest's id (or source); the guest's own key, never shown. */
    guestFingerprint: text("guest_fingerprint").notNull(),
  },
  (table) => [
    uniqueIndex("waiterCall_session_guest_unfinished_unique")
      .on(table.tableSessionId, table.guestFingerprint)
      .where(sql`${table.status} <> 'attended'`),
    index("waiterCall_location_status_idx").on(table.locationId, table.status),
  ],
);
