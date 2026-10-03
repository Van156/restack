import { index, integer, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

import { invitation, member, organization, user } from "./auth";
import { location } from "./restaurant";
import { station } from "./restaurant-setup";

/** Actions that need an Override (spec "Overrides"). */
export const OVERRIDE_ACTIONS = [
  "void_line",
  "discount",
  "reopen_bill",
  "close_shift_difference",
] as const;
export type OverrideAction = (typeof OVERRIDE_ACTIONS)[number];

export const overrideAction = pgEnum("override_action", OVERRIDE_ACTIONS);

/** A Paired device waits for its code (`pending`), works (`active`) or was cut off (`revoked`). */
export const pairedDeviceStatus = pgEnum("paired_device_status", ["pending", "active", "revoked"]);

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const organizationId = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

/** Locations a pending invitation grants once accepted (applied as Staff Location assignments). */
export const invitationLocation = pgTable(
  "invitation_location",
  {
    id: id(),
    organizationId: organizationId(),
    invitationId: text("invitation_id")
      .notNull()
      .references(() => invitation.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("invitationLocation_invitation_location_unique").on(
      table.invitationId,
      table.locationId,
    ),
    index("invitationLocation_organizationId_idx").on(table.organizationId),
  ],
);

/** A Staff member's PIN: salted hash only, with the failed-attempt counter and temporary lockout. */
export const staffPin = pgTable(
  "staff_pin",
  {
    id: id(),
    organizationId: organizationId(),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    pinHash: text("pin_hash").notNull(),
    failedAttempts: integer("failed_attempts").default(0).notNull(),
    lockedUntil: timestamp("locked_until"),
    /** Generation of the offline switch-in material, bumped to kill older material. See restaurant.md#offline-pin. */
    offlineEpoch: integer("offline_epoch").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("staffPin_member_unique").on(table.memberId),
    index("staffPin_organizationId_idx").on(table.organizationId),
  ],
);

/**
 * A minted Override: bound to Location, action and target, short-lived, single use. Its random id
 * doubles as the opaque token the requester presents.
 */
export const override = pgTable(
  "override",
  {
    id: id(),
    organizationId: organizationId(),
    locationId: text("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "cascade" }),
    approverMemberId: text("approver_member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    requesterMemberId: text("requester_member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    action: overrideAction("action").notNull(),
    /** What the Override covers (a line id, a Bill id, a shift id), opaque to this module. */
    target: text("target").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("override_organizationId_idx").on(table.organizationId)],
);

/** A Paired device (kitchen screen): token and activation code are stored as hashes only. */
export const pairedDevice = pgTable(
  "paired_device",
  {
    id: id(),
    organizationId: organizationId(),
    locationId: text("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: pairedDeviceStatus("status").default("pending").notNull(),
    tokenHash: text("token_hash").unique(),
    activationCodeHash: text("activation_code_hash").unique(),
    activationExpiresAt: timestamp("activation_expires_at"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastSeenAt: timestamp("last_seen_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("pairedDevice_organizationId_idx").on(table.organizationId),
    index("pairedDevice_locationId_idx").on(table.locationId),
  ],
);

/** The Stations a Paired device may read and update Tickets of. */
export const pairedDeviceStation = pgTable(
  "paired_device_station",
  {
    deviceId: text("device_id")
      .notNull()
      .references(() => pairedDevice.id, { onDelete: "cascade" }),
    stationId: text("station_id")
      .notNull()
      .references(() => station.id, { onDelete: "cascade" }),
  },
  (table) => [
    unique("pairedDeviceStation_device_station_unique").on(table.deviceId, table.stationId),
  ],
);
