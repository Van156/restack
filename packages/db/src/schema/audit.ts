import { sql } from "drizzle-orm";
import { check, index, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization, user } from "./auth";

/**
 * `audit_log` scope (spec §5, R7.1): `organization` entries belong to a tenant, `platform` ones are
 * never visible to tenants (R7.4), `user` ones are one person's security trail (account-settings
 * R7): no organization, never visible to tenants.
 */
export const auditLogScope = pgEnum("audit_log_scope", ["platform", "organization", "user"]);

/**
 * Append-only audit log (§5, R7), written through the `AuditLogger` port. The three user and
 * organization references use `ON DELETE SET NULL` so the log outlives the rows it describes;
 * `metadata` snapshots readable context for that reason. The check constraint only forbids a
 * `platform` entry with an organization (a `user` entry never has one either, by convention): an `organization` entry may later become NULL.
 * See docs/architecture/audit-log.md#table-rules.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    scope: auditLogScope("scope").notNull(),
    // Set for scope = "organization"; NULL later if the organization is deleted.
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    // NULL if the actor is deleted; `metadata` (`actorEmail`) still names them.
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    // Set only while a superadmin impersonates `actorUserId` (R7.2, R6.7).
    impersonatorUserId: text("impersonator_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    // R7.1 action, e.g. "member.role_changed".
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    // Before/after values plus a readable snapshot. Never secrets, tokens or passwords (R7.2).
    metadata: jsonb("metadata"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("auditLog_organizationId_createdAt_idx").on(table.organizationId, table.createdAt),
    index("auditLog_actorUserId_createdAt_idx").on(table.actorUserId, table.createdAt),
    index("auditLog_scope_createdAt_idx").on(table.scope, table.createdAt),
    check(
      "auditLog_scope_organizationId_check",
      sql`${table.scope} != 'platform' OR ${table.organizationId} IS NULL`,
    ),
  ],
);
