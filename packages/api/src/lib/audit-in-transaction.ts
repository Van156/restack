import type { AuditEvent } from "@base-template/auth/audit";
import { auditLog } from "@base-template/db/schema/audit";

import type { DbExecutor } from "./executor";

/**
 * Writes an audit row through the caller's executor instead of the audit port, so inside a
 * transaction it commits or rolls back together with the change it records.
 */
export async function recordAuditThrough(db: DbExecutor, event: AuditEvent): Promise<void> {
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
}
