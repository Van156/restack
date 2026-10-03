import { defineRelationsPart, sql } from "drizzle-orm";
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

import { member, organization, user } from "./auth";

/** Commercial plan of a Location: Esencial (no DIAN documents) or Completo (spec "Plans and trial"). */
export const LOCATION_PLANS = ["esencial", "completo"] as const;
export type LocationPlan = (typeof LOCATION_PLANS)[number];
export const locationPlan = pgEnum("location_plan", LOCATION_PLANS);

/**
 * A Location (Sede) of a Restaurant organization. Every Location-scoped row carries its
 * identifier; the organization identifier always comes from the authenticated context.
 */
export const location = pgTable(
  "location",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address"),
    /** Franchise tax class applies IVA 19% instead of impoconsumo 8%. */
    isFranchise: boolean("is_franchise").default(false).notNull(),
    dianEnabled: boolean("dian_enabled").default(false).notNull(),
    /** Who made the DIAN on/off choice and when (Owner only, audited). */
    dianChoiceByUserId: text("dian_choice_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    dianChoiceAt: timestamp("dian_choice_at"),
    waitersCanCharge: boolean("waiters_can_charge").default(false).notNull(),
    /** Suggested tip percent; legal maximum is 10. */
    suggestedTipPercent: integer("suggested_tip_percent").default(10).notNull(),
    plan: locationPlan("plan").default("completo").notNull(),
    trialEndsAt: timestamp("trial_ends_at"),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("location_organizationId_idx").on(table.organizationId),
    check(
      "location_suggestedTipPercent_check",
      sql`${table.suggestedTipPercent} >= 0 AND ${table.suggestedTipPercent} <= 10`,
    ),
  ],
);

/** Which Locations a Staff member may work in. The Owner needs no rows. */
export const staffLocationAssignment = pgTable(
  "staff_location_assignment",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("staffLocationAssignment_member_location_unique").on(table.memberId, table.locationId),
    index("staffLocationAssignment_organizationId_idx").on(table.organizationId),
    index("staffLocationAssignment_locationId_idx").on(table.locationId),
  ],
);

export const restaurantRelations = defineRelationsPart(
  { organization, member, location, staffLocationAssignment },
  (r) => ({
    location: {
      organization: r.one.organization({
        from: r.location.organizationId,
        to: r.organization.id,
      }),
      assignments: r.many.staffLocationAssignment({
        from: r.location.id,
        to: r.staffLocationAssignment.locationId,
      }),
    },
    staffLocationAssignment: {
      member: r.one.member({
        from: r.staffLocationAssignment.memberId,
        to: r.member.id,
      }),
      location: r.one.location({
        from: r.staffLocationAssignment.locationId,
        to: r.location.id,
      }),
    },
  }),
);
