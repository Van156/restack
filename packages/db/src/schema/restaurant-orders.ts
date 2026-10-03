import { defineRelationsPart, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { member, organization } from "./auth";
import { location } from "./restaurant";
import { diningTable, menuItem, menuTaxClass, station } from "./restaurant-setup";
import { override } from "./restaurant-staff";

/** A Table session is `open`, has had its `bill_requested`, or is `settled` (T6 settles it). */
export const TABLE_SESSION_STATUSES = ["open", "bill_requested", "settled"] as const;
export type TableSessionStatus = (typeof TABLE_SESSION_STATUSES)[number];
export const tableSessionStatus = pgEnum("table_session_status", TABLE_SESSION_STATUSES);

/** Ticket status order from the kitchen-display prototype. */
export const TICKET_STATUSES = ["nuevo", "preparando", "listo", "entregado"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const ticketStatus = pgEnum("ticket_status", TICKET_STATUSES);

export const DISCOUNT_KINDS = ["amount", "percent"] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];
export const discountKind = pgEnum("discount_kind", DISCOUNT_KINDS);

/** A modifier as recorded on an Order line: the name and delta at order time. */
export type OrderLineModifier = { modifierId: string; name: string; priceDelta: number };

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const organizationId = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

const locationId = () =>
  text("location_id")
    .notNull()
    .references(() => location.id, { onDelete: "cascade" });

/** Member columns keep history when the member leaves the organization (`set null`). */
const memberRef = (name: string) =>
  text(name).references(() => member.id, { onDelete: "set null" });

const createdAt = () => timestamp("created_at").defaultNow().notNull();

/**
 * One visit at a Table. At most one unsettled (open or bill requested) session per Table, enforced
 * by a partial unique index. `tableId` is `no action` toward `dining_table`: a Table with any
 * session, open or settled, cannot be deleted, so Bills and fiscal history never disappear; the
 * check runs at statement end so deleting a whole Location still cascades. T6 hangs the Bill off
 * this row.
 */
export const tableSession = pgTable(
  "table_session",
  {
    id: id(),
    organizationId: organizationId(),
    locationId: locationId(),
    tableId: text("table_id")
      .notNull()
      .references(() => diningTable.id, { onDelete: "no action" }),
    status: tableSessionStatus("status").default("open").notNull(),
    openedByMemberId: memberRef("opened_by_member_id"),
    openedAt: timestamp("opened_at").notNull(),
    settledAt: timestamp("settled_at"),
    /** Increments when the QR is regenerated (T11). */
    tokenVersion: integer("token_version").default(1).notNull(),
    shortCode: text("short_code").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("tableSession_open_table_unique")
      .on(table.tableId)
      .where(sql`${table.status} <> 'settled'`),
    index("tableSession_organizationId_idx").on(table.organizationId),
    index("tableSession_locationId_idx").on(table.locationId),
  ],
);

/**
 * Append-only Order line: never updated, changes are new records (`order_line_void`, tickets).
 * `unitPrice` is the Menu item price when the line was recorded and is never recomputed. The
 * idempotency key is unique per organization, so a replay finds the existing line.
 */
export const orderLine = pgTable(
  "order_line",
  {
    id: id(),
    organizationId: organizationId(),
    locationId: locationId(),
    tableSessionId: text("table_session_id")
      .notNull()
      .references(() => tableSession.id, { onDelete: "cascade" }),
    /** Kept for reports; `set null` when the Menu item is deleted (the snapshot below remains). */
    menuItemId: text("menu_item_id").references(() => menuItem.id, { onDelete: "set null" }),
    itemName: text("item_name").notNull(),
    unitPrice: integer("unit_price").notNull(),
    taxClass: menuTaxClass("tax_class").notNull(),
    modifiers: jsonb("modifiers").$type<OrderLineModifier[]>().default([]).notNull(),
    quantity: integer("quantity").notNull(),
    note: text("note"),
    recordedByMemberId: memberRef("recorded_by_member_id"),
    /** Device time when recorded offline, if the client sent one. */
    clientRecordedAt: timestamp("client_recorded_at"),
    recordedAt: timestamp("recorded_at").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique("orderLine_org_idempotencyKey_unique").on(table.organizationId, table.idempotencyKey),
    index("orderLine_tableSessionId_idx").on(table.tableSessionId),
    check("orderLine_quantity_check", sql`${table.quantity} >= 1`),
    check("orderLine_unitPrice_check", sql`${table.unitPrice} >= 0`),
  ],
);

/**
 * Removal of an Order line. `overrideId` is set when the line had been sent to the kitchen; an
 * unsent line is simply removed. A line is voided at most once.
 */
export const orderLineVoid = pgTable(
  "order_line_void",
  {
    id: id(),
    organizationId: organizationId(),
    orderLineId: text("order_line_id")
      .notNull()
      .references(() => orderLine.id, { onDelete: "cascade" }),
    reason: text("reason"),
    overrideId: text("override_id").references(() => override.id, { onDelete: "set null" }),
    recordedByMemberId: memberRef("recorded_by_member_id"),
    recordedAt: timestamp("recorded_at").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique("orderLineVoid_orderLine_unique").on(table.orderLineId),
    unique("orderLineVoid_org_idempotencyKey_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
  ],
);

/** A discount on a Table session (amount in COP or percent), always backed by an Override. */
export const discount = pgTable(
  "discount",
  {
    id: id(),
    organizationId: organizationId(),
    tableSessionId: text("table_session_id")
      .notNull()
      .references(() => tableSession.id, { onDelete: "cascade" }),
    kind: discountKind("kind").notNull(),
    value: integer("value").notNull(),
    overrideId: text("override_id").references(() => override.id, { onDelete: "set null" }),
    approverMemberId: memberRef("approver_member_id"),
    recordedByMemberId: memberRef("recorded_by_member_id"),
    recordedAt: timestamp("recorded_at").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("discount_tableSessionId_idx").on(table.tableSessionId),
    check(
      "discount_value_check",
      sql`${table.value} >= 1 AND (${table.kind} <> 'percent' OR ${table.value} <= 100)`,
    ),
  ],
);

/**
 * A Ticket: the lines of one send that a Station prepares. The status timestamps follow the
 * kitchen-display prototype (`sentAt`, `startedAt`, `readyAt`, `deliveredAt`). Deleting a Station
 * removes its Tickets (operational data; the Order lines stay).
 */
export const ticket = pgTable(
  "ticket",
  {
    id: id(),
    organizationId: organizationId(),
    locationId: locationId(),
    tableSessionId: text("table_session_id")
      .notNull()
      .references(() => tableSession.id, { onDelete: "cascade" }),
    stationId: text("station_id")
      .notNull()
      .references(() => station.id, { onDelete: "cascade" }),
    status: ticketStatus("status").default("nuevo").notNull(),
    sentByMemberId: memberRef("sent_by_member_id"),
    sentAt: timestamp("sent_at").notNull(),
    startedAt: timestamp("started_at"),
    readyAt: timestamp("ready_at"),
    deliveredAt: timestamp("delivered_at"),
    createdAt: createdAt(),
  },
  (table) => [
    index("ticket_tableSessionId_idx").on(table.tableSessionId),
    index("ticket_station_status_idx").on(table.stationId, table.status),
    index("ticket_organizationId_idx").on(table.organizationId),
  ],
);

/** Which Ticket an Order line was sent on. A line is sent once; "sent" means a row exists here. */
export const ticketLine = pgTable(
  "ticket_line",
  {
    ticketId: text("ticket_id")
      .notNull()
      .references(() => ticket.id, { onDelete: "cascade" }),
    orderLineId: text("order_line_id")
      .notNull()
      .references(() => orderLine.id, { onDelete: "cascade" }),
  },
  (table) => [
    unique("ticketLine_orderLine_unique").on(table.orderLineId),
    index("ticketLine_ticketId_idx").on(table.ticketId),
  ],
);

export const restaurantOrdersRelations = defineRelationsPart(
  { diningTable, tableSession, orderLine, discount, ticket, ticketLine, station },
  (r) => ({
    tableSession: {
      table: r.one.diningTable({ from: r.tableSession.tableId, to: r.diningTable.id }),
      lines: r.many.orderLine({ from: r.tableSession.id, to: r.orderLine.tableSessionId }),
      discounts: r.many.discount({ from: r.tableSession.id, to: r.discount.tableSessionId }),
      tickets: r.many.ticket({ from: r.tableSession.id, to: r.ticket.tableSessionId }),
    },
    orderLine: {
      session: r.one.tableSession({ from: r.orderLine.tableSessionId, to: r.tableSession.id }),
    },
    ticket: {
      session: r.one.tableSession({ from: r.ticket.tableSessionId, to: r.tableSession.id }),
      station: r.one.station({ from: r.ticket.stationId, to: r.station.id }),
      lines: r.many.ticketLine({ from: r.ticket.id, to: r.ticketLine.ticketId }),
    },
  }),
);
