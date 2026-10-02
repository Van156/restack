import type { Database } from "@base-template/db";
import { auditLog } from "@base-template/db/schema/audit";
import { inArray, lt } from "drizzle-orm";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Most rows one DELETE removes, bounding what a single statement locks and scans. */
const PURGE_BATCH_SIZE = 1000;

/**
 * Deletes `audit_log` rows older than `retentionDays` (R7.6) in batches and returns the count.
 * `retentionDays` MUST be positive; unset means keep forever and callers never get here.
 * Counts via `rowCount`, never `.returning()`, so row data stays out of the process.
 * See docs/architecture/audit-log.md#retention.
 */
export async function purgeExpiredAuditLog(
  db: Database,
  retentionDays: number,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - retentionDays * MS_PER_DAY);
  let totalDeleted = 0;
  for (;;) {
    const idsToDelete = db
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(lt(auditLog.createdAt, cutoff))
      .limit(PURGE_BATCH_SIZE);
    const result = await db.delete(auditLog).where(inArray(auditLog.id, idsToDelete));
    const deletedInBatch = result.rowCount ?? 0;
    totalDeleted += deletedInBatch;
    if (deletedInBatch < PURGE_BATCH_SIZE) {
      break;
    }
  }
  return totalDeleted;
}
