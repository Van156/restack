import {
  listPlatformOrganizations,
  listPlatformUsers,
  UnsupportedFilterError,
} from "@base-template/auth/platform";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { platformProcedure } from "../index";
import { createListInput } from "../lib/list-input";
import {
  platformOrganizationsListConfig,
  platformUsersListConfig,
} from "../lib/platform-list-config";
import { platformHealthRouter } from "./platform-health";

/** Shared list inputs (spec §6.4): page, perPage, sort, filters over the allowlisted columns. */
const usersListInput = createListInput(platformUsersListConfig);
const organizationsListInput = createListInput(platformOrganizationsListConfig);

/**
 * Platform (superadmin-only) procedures (R6). Impersonation (R6.4) goes through the better-auth
 * client, not oRPC. See docs/architecture/authorization.md#platform-admin-port
 */
export const platformRouter = {
  users: {
    /** R6.2: sort/search/paginate all users; a database failure rejects so the table shows its error state. */
    list: platformProcedure({ user: ["list"] })
      .input(usersListInput)
      .handler(async ({ context, input }) => {
        try {
          return await listPlatformUsers(context.db, input);
        } catch (error) {
          // A filter shape the listing cannot express is the caller's mistake, not a server fault.
          if (error instanceof UnsupportedFilterError) {
            throw new ORPCError("BAD_REQUEST", { message: error.message });
          }
          throw error;
        }
      }),

    /** One user by id, plus the `DEFAULT_MAX_ORGS_PER_USER` fallback for the limit form (R6.6). */
    get: platformProcedure({ user: ["get"] })
      .input(z.object({ userId: z.string() }))
      .handler(async ({ context, input }) => {
        const user = await context.platformAdmin.getUser(context.headers, input.userId);
        return { user, defaultMaxOrganizationsPerUser: context.defaultMaxOrganizationsPerUser };
      }),

    /** R6.3: ban with a reason and optional expiry; better-auth revokes sessions and blocks sign-in. */
    ban: platformProcedure({ user: ["ban"] })
      .input(
        z.object({
          userId: z.string(),
          reason: z.string().min(1),
          expiresInSeconds: z.number().int().positive().optional(),
        }),
      )
      .handler(({ context, input }) => context.platformAdmin.banUser(context.headers, input)),

    /** R6.3: unban. */
    unban: platformProcedure({ user: ["ban"] })
      .input(z.object({ userId: z.string() }))
      .handler(({ context, input }) =>
        context.platformAdmin.unbanUser(context.headers, input.userId),
      ),

    /** R6.6: override (or clear with `null`) the organization-ownership limit; gated on `user:update`. */
    setOrganizationLimit: platformProcedure({ user: ["update"] })
      .input(
        z.object({
          userId: z.string(),
          maxOrganizations: z.number().int().min(0).nullable(),
        }),
      )
      .handler(({ context, input }) =>
        context.platformAdmin.setOrganizationLimit(context.headers, input),
      ),
  },

  organizations: {
    /** R6.2: sort/filter/paginate organizations across tenants; `organization:list` is template-defined. */
    list: platformProcedure({ organization: ["list"] })
      .input(organizationsListInput)
      .handler(({ context, input }) => listPlatformOrganizations(context.db, input)),
  },

  /** Restaurant product health: Weekly Active and Activated Locations. */
  health: platformHealthRouter,
};
