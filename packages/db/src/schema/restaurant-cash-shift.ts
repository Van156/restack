import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { member, organization } from "./auth";
import { location } from "./restaurant";
import { override } from "./restaurant-staff";

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

/** Counted money per tender at close, in COP. */
export type CountedByTender = { cash: number; card: number; qr_transfer: number };

/**
 * A Cash shift: a Location's takings window. Open while `closedAt` is null, and the partial unique
 * index allows one open shift per Location. `expected`, `counted` and `difference` are written at close.
 */
export const cashShift = pgTable(
  "cash_shift",
  {
    id: id(),
    organizationId: organizationId(),
    locationId: text("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "cascade" }),
    openedByMemberId: memberRef("opened_by_member_id"),
    openedAt: timestamp("opened_at").notNull(),
    openingAmount: integer("opening_amount").notNull(),
    closedByMemberId: memberRef("closed_by_member_id"),
    closedAt: timestamp("closed_at"),
    expected: integer("expected"),
    counted: integer("counted"),
    difference: integer("difference"),
    countedByTender: jsonb("counted_by_tender").$type<CountedByTender>(),
    /** The Override spent to close with a difference. */
    overrideId: text("override_id").references(() => override.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("cashShift_oneOpenPerLocation_unique")
      .on(table.locationId)
      .where(sql`${table.closedAt} IS NULL`),
    index("cashShift_organizationId_idx").on(table.organizationId),
    index("cashShift_locationId_openedAt_idx").on(table.locationId, table.openedAt),
    check("cashShift_openingAmount_check", sql`${table.openingAmount} >= 0`),
  ],
);

/**
 * Who shares the tips of a Cash shift: a Staff member or a person added by name. `sharePercent` is
 * set on every row of a shift (agreed split) or on none (equal split).
 */
export const tipBeneficiary = pgTable(
  "tip_beneficiary",
  {
    id: id(),
    organizationId: organizationId(),
    cashShiftId: text("cash_shift_id")
      .notNull()
      .references(() => cashShift.id, { onDelete: "cascade" }),
    memberId: memberRef("member_id"),
    displayName: text("display_name").notNull(),
    sharePercent: integer("share_percent"),
    /** Order in the list; breaks ties when leftover pesos are handed out. */
    position: integer("position").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("tipBeneficiary_shift_position_unique").on(table.cashShiftId, table.position),
    index("tipBeneficiary_cashShiftId_idx").on(table.cashShiftId),
    check(
      "tipBeneficiary_sharePercent_check",
      sql`${table.sharePercent} IS NULL OR (${table.sharePercent} >= 1 AND ${table.sharePercent} <= 100)`,
    ),
  ],
);

/** A beneficiary's share of a closed shift's tips, computed once by `cashShift.distributeTips`. */
export const tipDistribution = pgTable(
  "tip_distribution",
  {
    id: id(),
    organizationId: organizationId(),
    cashShiftId: text("cash_shift_id")
      .notNull()
      .references(() => cashShift.id, { onDelete: "cascade" }),
    beneficiaryId: text("beneficiary_id")
      .notNull()
      .references(() => tipBeneficiary.id, { onDelete: "cascade" }),
    /** Snapshot of who received it, so the report survives later edits. */
    memberId: memberRef("member_id"),
    displayName: text("display_name").notNull(),
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("tipDistribution_shift_beneficiary_unique").on(table.cashShiftId, table.beneficiaryId),
    index("tipDistribution_cashShiftId_idx").on(table.cashShiftId),
    check("tipDistribution_amount_check", sql`${table.amount} >= 0`),
  ],
);
