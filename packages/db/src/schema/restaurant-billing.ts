import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { member, organization } from "./auth";
import { location } from "./restaurant";
import { tableSession } from "./restaurant-orders";

/** A Bill is `open` until settled, `settled` when paid in full and `reopened` after an Override. */
export const BILL_STATUSES = ["open", "settled", "reopened"] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];
export const billStatus = pgEnum("bill_status", BILL_STATUSES);

export const PAYMENT_TENDERS = ["cash", "card", "qr_transfer"] as const;
export type PaymentTender = (typeof PAYMENT_TENDERS)[number];
export const paymentTender = pgEnum("payment_tender", PAYMENT_TENDERS);

export const BUYER_DOCUMENT_TYPES = ["cc", "ce", "nit", "ti", "pp", "te"] as const;
export type BuyerDocumentType = (typeof BUYER_DOCUMENT_TYPES)[number];
export const buyerDocumentType = pgEnum("buyer_document_type", BUYER_DOCUMENT_TYPES);

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const organizationId = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

const memberRef = (name: string) =>
  text(name).references(() => member.id, { onDelete: "set null" });

/**
 * The charge state of a Table session (one per session, created on the first tip or payment).
 * Totals are computed from the lines; the snapshot columns are written when the Bill settles.
 */
export const bill = pgTable(
  "bill",
  {
    id: id(),
    organizationId: organizationId(),
    locationId: text("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "cascade" }),
    tableSessionId: text("table_session_id")
      .notNull()
      .references(() => tableSession.id, { onDelete: "cascade" }),
    status: billStatus("status").default("open").notNull(),
    /** Voluntary tip, outside the tax base; zero when there is none. */
    tipAmount: integer("tip_amount").default(0).notNull(),
    tipUpdatedByMemberId: memberRef("tip_updated_by_member_id"),
    tipUpdatedAt: timestamp("tip_updated_at"),
    base: integer("base"),
    tax: integer("tax"),
    discountTotal: integer("discount_total"),
    total: integer("total"),
    settledAt: timestamp("settled_at"),
    settledByMemberId: memberRef("settled_by_member_id"),
    reopenedAt: timestamp("reopened_at"),
    reopenedByMemberId: memberRef("reopened_by_member_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("bill_tableSession_unique").on(table.tableSessionId),
    index("bill_organizationId_idx").on(table.organizationId),
    index("bill_locationId_idx").on(table.locationId),
    check("bill_tipAmount_check", sql`${table.tipAmount} >= 0`),
  ],
);

/**
 * A payment against a Bill. `amount` is what it covers; cash also records the amount handed over
 * (`tendered`), so the change is `tendered - amount`. The idempotency key is unique per organization.
 */
export const payment = pgTable(
  "payment",
  {
    id: id(),
    organizationId: organizationId(),
    locationId: text("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "cascade" }),
    billId: text("bill_id")
      .notNull()
      .references(() => bill.id, { onDelete: "cascade" }),
    tender: paymentTender("tender").notNull(),
    amount: integer("amount").notNull(),
    tendered: integer("tendered"),
    reference: text("reference"),
    registeredOffline: boolean("registered_offline").default(false).notNull(),
    recordedByMemberId: memberRef("recorded_by_member_id"),
    /** Sale time on the device when it was recorded offline. */
    clientRecordedAt: timestamp("client_recorded_at"),
    recordedAt: timestamp("recorded_at").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("payment_org_idempotencyKey_unique").on(table.organizationId, table.idempotencyKey),
    index("payment_billId_idx").on(table.billId),
    index("payment_locationId_recordedAt_idx").on(table.locationId, table.recordedAt),
    check("payment_amount_check", sql`${table.amount} >= 1`),
    check(
      "payment_tendered_check",
      sql`${table.tendered} IS NULL OR ${table.tendered} >= ${table.amount}`,
    ),
    check("payment_cashTendered_check", sql`${table.tender} = 'cash' OR ${table.tendered} IS NULL`),
    check(
      "payment_reference_check",
      sql`${table.tender} = 'cash' OR length(trim(coalesce(${table.reference}, ''))) > 0`,
    ),
  ],
);

/** A buyer saved for factura electrónica; exists only with the buyer's recorded consent. */
export const buyer = pgTable(
  "buyer",
  {
    id: id(),
    organizationId: organizationId(),
    documentType: buyerDocumentType("document_type").notNull(),
    documentNumber: text("document_number").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    consent: boolean("consent").notNull(),
    consentAt: timestamp("consent_at").notNull(),
    createdByMemberId: memberRef("created_by_member_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("buyer_org_document_unique").on(
      table.organizationId,
      table.documentType,
      table.documentNumber,
    ),
    index("buyer_organizationId_name_idx").on(table.organizationId, table.name),
    check("buyer_consent_check", sql`${table.consent} = true`),
  ],
);
