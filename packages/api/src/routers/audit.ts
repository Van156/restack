import {
  listOrganizationAuditLog,
  listPlatformAuditLog,
  listUserAuditLog,
} from "@base-template/auth/audit";
import { z } from "zod";

import {
  orgAuditListConfig,
  platformAuditListConfig,
  userAuditListConfig,
} from "../lib/audit-list-config";
import { createListInput } from "../lib/list-input";
import { orgProcedure, platformProcedure, protectedProcedure, requirePermission } from "../index";

/**
 * Server-driven list inputs (`createListInput`, spec §6.4): sort and filter ids come only from
 * the allowlists in `audit-list-config.ts`, which the web table shares. Pagination is
 * `page`/`perPage` (page size and offset capped by `@base-template/db/lib/pagination`).
 */
const orgListInput = createListInput(orgAuditListConfig);
const platformListInput = createListInput(platformAuditListConfig);
const userListInput = createListInput(userAuditListConfig);

/**
 * Audit log reads (R7.4, R7.5). `list` is scoped to the session org (R5.1); `listPlatform` only
 * narrows via filters and needs a platform permission (R6.5). Both return `{ rows, total }`.
 */
export const auditRouter = {
  /** Organization activity log (R7.4): requires `audit:read` in the active organization. */
  list: orgProcedure
    .use(requirePermission({ audit: ["read"] }))
    .input(orgListInput)
    .handler(({ context, input }) => {
      return listOrganizationAuditLog(context.db, {
        organizationId: context.org.id,
        input,
      });
    }),

  /** Platform activity log (R7.5, R6.7): every entry, both scopes, superadmin-only. */
  listPlatform: platformProcedure({ audit: ["read"] })
    .input(platformListInput)
    .handler(({ context, input }) => {
      return listPlatformAuditLog(context.db, input);
    }),

  /**
   * Security log of the signed-in user (account-settings R7.1): their own `user`-scoped rows,
   * newest first. The user comes from the session, never from input.
   */
  listSelf: protectedProcedure.input(userListInput).handler(({ context, input }) => {
    return listUserAuditLog(context.db, { userId: context.session.user.id, input });
  }),

  /**
   * Security log of any user (account-settings R7.2): superadmin-only (`audit:read` is a platform
   * permission), by user id. Organization admins never reach it, so they never see user rows.
   */
  listUser: platformProcedure({ audit: ["read"] })
    .input(userListInput.extend({ userId: z.string().min(1) }))
    .handler(({ context, input: { userId, ...input } }) => {
      return listUserAuditLog(context.db, { userId, input });
    }),
};
