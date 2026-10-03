import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc as platformBuiltInAdminAc,
  defaultStatements as adminDefaultStatements,
  userAc as platformBuiltInUserAc,
} from "better-auth/plugins/admin/access";

/**
 * Platform permission catalog: better-auth's admin defaults plus `audit` (R7.5, R6.7),
 * `organization` (R6.2) and `health` (restaurant product-health metrics). `organization` is
 * template-defined: better-auth's `listOrganizations` is scoped to the caller's memberships, so
 * this gates `@base-template/auth/platform`'s own query.
 */
export const platformStatements = {
  ...adminDefaultStatements,
  audit: ["read"],
  organization: ["list"],
  health: ["read"],
} as const;

export const platformAc = createAccessControl(platformStatements);

/**
 * Built-in platform role: better-auth's built-in admin permissions, which
 * withhold `user:impersonate-admins` so a superadmin can only impersonate
 * non-superadmin users (spec R6.4), plus `audit:read` (R7.5) and
 * `organization:list` (R6.2).
 */
export const superadmin = platformAc.newRole({
  ...platformBuiltInAdminAc.statements,
  audit: ["read"],
  organization: ["list"],
  health: ["read"],
});

/** Built-in platform role: an ordinary user, no platform permissions. */
export const user = platformAc.newRole({ ...platformBuiltInUserAc.statements });

/** Convenience map for better-auth's `admin({ roles })` option */
export const platformRoles = { superadmin, user } as const;
