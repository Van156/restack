import type { Database } from "@base-template/db";
import { auditLog } from "@base-template/db/schema/audit";

import type { AuditEvent, AuditLogger } from "./types";

/**
 * `AuditLogger` backed by Drizzle (`audit_log`, §5). A failed write is logged and rethrown,
 * failing the request (R7.2); the triggering mutation has usually committed already and is not
 * rolled back. See docs/architecture/audit-log.md#failure-policy.
 */
export function createDrizzleAuditLogger(db: Database): AuditLogger {
  return {
    async record(event: AuditEvent): Promise<void> {
      try {
        await db.insert(auditLog).values({
          scope: event.scope,
          organizationId: event.organizationId ?? null,
          actorUserId: event.actorUserId,
          impersonatorUserId: event.impersonatorUserId ?? null,
          action: event.action,
          targetType: event.targetType,
          targetId: event.targetId,
          metadata: event.metadata ?? null,
          ip: event.ip ?? null,
          userAgent: event.userAgent ?? null,
        });
      } catch (error) {
        console.error("[audit] failed to record event", {
          scope: event.scope,
          action: event.action,
          targetType: event.targetType,
          targetId: event.targetId,
          error,
        });
        throw error;
      }
    },
  };
}
