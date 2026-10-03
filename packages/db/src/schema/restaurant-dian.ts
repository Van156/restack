import { sql } from "drizzle-orm";
import {
  boolean,
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

import { organization, user } from "./auth";
import { location } from "./restaurant";
import { bill, buyerDocumentType } from "./restaurant-billing";

export const DIAN_DOCUMENT_KINDS = ["pos_equivalent", "factura"] as const;
export type DianDocumentKind = (typeof DIAN_DOCUMENT_KINDS)[number];
export const dianDocumentKind = pgEnum("dian_document_kind", DIAN_DOCUMENT_KINDS);

/** A document is `pending` until the provider answers, then `issued` or `rejected`. */
export const DIAN_DOCUMENT_STATUSES = ["pending", "issued", "rejected"] as const;
export type DianDocumentStatus = (typeof DIAN_DOCUMENT_STATUSES)[number];
export const dianDocumentStatus = pgEnum("dian_document_status", DIAN_DOCUMENT_STATUSES);

export const DIAN_HABILITACION_STATUSES = ["not_started", "in_progress", "enabled"] as const;
export type DianHabilitacionStatus = (typeof DIAN_HABILITACION_STATUSES)[number];
export const dianHabilitacionStatus = pgEnum(
  "dian_habilitacion_status",
  DIAN_HABILITACION_STATUSES,
);

export const DIAN_PROVIDERS = ["alegra"] as const;
export type DianProvider = (typeof DIAN_PROVIDERS)[number];
export const dianProvider = pgEnum("dian_provider", DIAN_PROVIDERS);

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

/** The provider company and numbering a Location issues under; never holds a token. */
export const dianConnection = pgTable(
  "dian_connection",
  {
    id: id(),
    organizationId: organizationId(),
    locationId: locationId(),
    provider: dianProvider("provider").notNull(),
    companyReference: text("company_reference").notNull(),
    numberingPrefix: text("numbering_prefix"),
    habilitacion: dianHabilitacionStatus("habilitacion").default("not_started").notNull(),
    connectedByUserId: text("connected_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    connectedAt: timestamp("connected_at").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [unique("dianConnection_location_unique").on(table.locationId)],
);

/**
 * A DIAN document for a settled Bill, unique per Bill and kind, which makes issuing idempotent.
 * `payload` is the Bill snapshot sent to the provider; later tip changes never touch it.
 */
export const dianDocument = pgTable(
  "dian_document",
  {
    id: id(),
    organizationId: organizationId(),
    locationId: locationId(),
    billId: text("bill_id")
      .notNull()
      .references(() => bill.id, { onDelete: "cascade" }),
    kind: dianDocumentKind("kind").notNull(),
    status: dianDocumentStatus("status").default("pending").notNull(),
    /** Null for consumidor final. */
    buyerDocumentType: buyerDocumentType("buyer_document_type"),
    buyerDocumentNumber: text("buyer_document_number"),
    buyerName: text("buyer_name"),
    number: text("number"),
    providerReference: text("provider_reference"),
    cude: text("cude"),
    qrData: text("qr_data"),
    rejectionReason: text("rejection_reason"),
    /** Original sale time; offline sales keep the device time. */
    saleTime: timestamp("sale_time").notNull(),
    contingency: boolean("contingency").default(false).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    /** Resubmissions after a rejection; part of the provider idempotency key. */
    submissions: integer("submissions").default(0).notNull(),
    issuedAt: timestamp("issued_at"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("dianDocument_bill_kind_unique").on(table.billId, table.kind),
    index("dianDocument_locationId_saleTime_idx").on(table.locationId, table.saleTime),
  ],
);

/** Transmission queue of a document: retries with backoff and the 48 hour deadline. */
export const dianOutbox = pgTable(
  "dian_outbox",
  {
    id: id(),
    organizationId: organizationId(),
    locationId: locationId(),
    documentId: text("document_id")
      .notNull()
      .references(() => dianDocument.id, { onDelete: "cascade" }),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at").notNull(),
    transmitBy: timestamp("transmit_by").notNull(),
    overdueAt: timestamp("overdue_at"),
    lastError: text("last_error"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("dianOutbox_document_unique").on(table.documentId),
    index("dianOutbox_pending_idx").on(table.completedAt, table.nextAttemptAt),
    index("dianOutbox_locationId_idx").on(table.locationId),
  ],
);

/** Evidence of a period where documents could not be transmitted; at most one open per Location. */
export const dianIncident = pgTable(
  "dian_incident",
  {
    id: id(),
    organizationId: organizationId(),
    locationId: locationId(),
    cause: text("cause").notNull(),
    startedAt: timestamp("started_at").notNull(),
    endedAt: timestamp("ended_at"),
    documentsCovered: integer("documents_covered").default(0).notNull(),
    reported: boolean("reported").default(false).notNull(),
  },
  (table) => [
    uniqueIndex("dianIncident_open_unique")
      .on(table.locationId)
      .where(sql`${table.endedAt} IS NULL`),
    index("dianIncident_locationId_startedAt_idx").on(table.locationId, table.startedAt),
    check("dianIncident_documentsCovered_check", sql`${table.documentsCovered} >= 0`),
  ],
);

/** Issued documents per Location and Bogota calendar month (`YYYY-MM`). */
export const dianDocumentCounter = pgTable(
  "dian_document_counter",
  {
    id: id(),
    organizationId: organizationId(),
    locationId: locationId(),
    month: text("month").notNull(),
    count: integer("count").default(0).notNull(),
  },
  (table) => [
    unique("dianDocumentCounter_location_month_unique").on(table.locationId, table.month),
    check("dianDocumentCounter_count_check", sql`${table.count} >= 0`),
  ],
);
