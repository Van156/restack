import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

import { member, organization } from "./auth";
import { location } from "./restaurant";

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
