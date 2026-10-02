// Allowlists of the platform admin list inputs (spec §6.4, §7). Pure data shared by the oRPC
// procedures (`createListInput`) and the web tables (columns, route search), so the columns the
// UI offers are exactly the ones the server accepts.
//
// Both lists come from Drizzle queries over the shared list input (`listPlatformUsers`,
// `listPlatformOrganizations` in `@base-template/auth/platform`). Their columns stay simple-mode
// sized on purpose (spec §6.2: both lists stay in simple mode).
import type { ListInputConfig } from "./list-input";

/** Platform role names (`platformRoles` in `@base-template/auth`; a test keeps them in sync). */
export const PLATFORM_ROLE_NAMES = ["superadmin", "user"] as const;

/** User account states a list can be narrowed to. `banned` means the `banned` flag is set; a NULL flag is active. */
export const USER_STATUSES = ["active", "banned"] as const;

const DEFAULT_SORT = [{ id: "createdAt", desc: true }] as const;

/**
 * Platform users (`platform.users.list`). `status` filters the `banned` flag and `role` matches
 * one platform role (the column may hold several, comma-separated). Sorting by `status` is not offered (the flag is nullable and low value).
 */
export const platformUsersListConfig = {
  sortableColumns: ["email", "name", "role", "createdAt"],
  filterableColumns: {
    email: "text",
    name: "text",
    role: { variant: "select", options: PLATFORM_ROLE_NAMES },
    status: { variant: "select", options: USER_STATUSES },
  },
  defaultSort: DEFAULT_SORT,
} as const satisfies ListInputConfig<string, string>;

/** Platform organizations (`platform.organizations.list`). The member count is not sortable (aggregate). */
export const platformOrganizationsListConfig = {
  sortableColumns: ["name", "slug", "createdAt"],
  filterableColumns: {
    name: "text",
    slug: "text",
  },
  defaultSort: DEFAULT_SORT,
} as const satisfies ListInputConfig<string, string>;
