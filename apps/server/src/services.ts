import { createBetterAuthAuthorization } from "@base-template/api/authorization";
import { createBetterAuthPlatformAdmin } from "@base-template/api/platform-admin";
import { createAuth } from "@base-template/auth";
import type { AuditRetentionJobHandle } from "@base-template/auth/audit";
import { createDrizzleAuditLogger, startAuditRetentionJob } from "@base-template/auth/audit";
import { createEmailSender } from "@base-template/auth/email";
import { createDb } from "@base-template/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const emailSender = createEmailSender(ENV);
export const auditLogger = createDrizzleAuditLogger(db);
export const auth = createAuth(ENV, db, emailSender, auditLogger);
export const authorization = createBetterAuthAuthorization(auth);
export const platformAdmin = createBetterAuthPlatformAdmin(auth);

/**
 * Starts the background jobs (the R7.6 audit retention job) and returns a handle to stop them.
 * Deliberately not run at import: scripts and tests import this module, and a live timer must
 * never start as a side effect. Only `index.ts` calls it.
 */
export function startBackgroundJobs(): { stop: () => void } {
  // R7.6: unset AUDIT_LOG_RETENTION_DAYS means "keep forever" — no job starts.
  const retentionJob: AuditRetentionJobHandle | null = startAuditRetentionJob(
    db,
    ENV.AUDIT_LOG_RETENTION_DAYS,
  );
  return {
    stop: () => {
      retentionJob?.stop();
    },
  };
}
