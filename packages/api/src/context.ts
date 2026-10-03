import type { Session } from "@base-template/auth";
import type { AuditLogger } from "@base-template/auth/audit";
import type { Database } from "@base-template/db";

import type { AuthorizationPort } from "./authorization";
import type { PlatformAdminPort } from "./platform-admin";

/** Injectable time source: the system clock in production, a controllable one in tests. */
export type Clock = { now: () => Date };

export type Context = {
  session: Session | null;
  db: Database;
  /** Inbound request headers; ports re-derive session and active organization from them. */
  headers: Headers;
  authorization: AuthorizationPort;
  /** R6: platform admin actions; impersonation uses the better-auth client instead. */
  platformAdmin: PlatformAdminPort;
  /**
   * Audit port (R7.2) for mutations the procedures perform directly in the database, which
   * better-auth's hooks never see (e.g. `organization.transferOwnership`). Type-only import:
   * `packages/api` needs no better-auth runtime dependency.
   */
  auditLogger: AuditLogger;
  /** `DEFAULT_MAX_ORGS_PER_USER` (R1.1b), shown as the fallback when a user's override is cleared (R6.6). */
  defaultMaxOrganizationsPerUser: number;
  /** Every time-dependent behaviour reads time here, never from `new Date()` directly. */
  clock: Clock;
  /** Server secret that signs acting tokens (HMAC); the composition root passes `BETTER_AUTH_SECRET`. */
  actingTokenSecret: string;
};
