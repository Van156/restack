import {
  orgAuditListConfig,
  platformAuditListConfig,
  userAuditListConfig,
} from "@base-template/api/lib/audit-list-config";
import { createListInput } from "@base-template/api/lib/list-input";
import { z } from "zod";

import type { DataTableSearch, DataTableSearchConfig } from "@/shared/lib/data-table/search";

import { isFilterAccepted, toListInput } from "@/shared/lib/data-table/list-input";
import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";

const DEFAULT_PER_PAGE = 20;
const DEFAULT_SORT = [{ id: "createdAt", desc: true }] as const;

/**
 * Server list inputs, built from the same allowlists as the oRPC procedures
 * (`audit-list-config.ts`), so the columns the table offers are the ones the server accepts.
 */
export const orgAuditListInput = createListInput(orgAuditListConfig);
export const platformAuditListInput = createListInput(platformAuditListConfig);
export const userAuditListInput = createListInput(userAuditListConfig);

/** Sortable ids and filterable ids of the organization log; a test pins them to the server config. */
export const orgAuditSearchConfig = {
  columnIds: ["createdAt", "action", "targetType"],
  filterableColumnIds: ["createdAt", "action", "actor", "targetType"],
  defaultSort: DEFAULT_SORT,
  defaultPerPage: DEFAULT_PER_PAGE,
} as const satisfies DataTableSearchConfig<
  "createdAt" | "action" | "targetType",
  "createdAt" | "action" | "actor" | "targetType"
>;

export const platformAuditSearchConfig = {
  columnIds: ["createdAt", "scope", "action", "targetType"],
  filterableColumnIds: ["createdAt", "scope", "organization", "actor", "action", "targetType"],
  defaultSort: DEFAULT_SORT,
  defaultPerPage: DEFAULT_PER_PAGE,
} as const satisfies DataTableSearchConfig<
  "createdAt" | "scope" | "action" | "targetType",
  "createdAt" | "scope" | "organization" | "actor" | "action" | "targetType"
>;

/** Sortable and filterable ids of a user's security log (`audit.listSelf`). */
export const userAuditSearchConfig = {
  columnIds: ["createdAt", "action"],
  filterableColumnIds: ["createdAt", "action"],
  defaultSort: DEFAULT_SORT,
  defaultPerPage: DEFAULT_PER_PAGE,
} as const satisfies DataTableSearchConfig<"createdAt" | "action", "createdAt" | "action">;

/** Drops filters the list input would reject (e.g. a hand-edited variant or option). */
function acceptedFilters<TSearch extends { filters: DataTableSearch["filters"] }>(
  listInput: typeof orgAuditListInput | typeof platformAuditListInput | typeof userAuditListInput,
  search: TSearch,
): TSearch {
  return { ...search, filters: search.filters.filter((item) => isFilterAccepted(listInput, item)) };
}

/** `validateSearch` of `/settings/activity`. */
export const orgAuditSearchSchema = createDataTableSearchSchema(orgAuditSearchConfig).transform(
  (search) => acceptedFilters(orgAuditListInput, search),
);

/** `validateSearch` of `/admin/activity`. */
export const platformAuditSearchSchema = createDataTableSearchSchema(
  platformAuditSearchConfig,
).transform((search) => acceptedFilters(platformAuditListInput, search));

/** `validateSearch` of `/account/security`. */
export const userAuditSearchSchema = createDataTableSearchSchema(userAuditSearchConfig).transform(
  (search) => acceptedFilters(userAuditListInput, search),
);

/**
 * Search values that are the default view. The router serializes the *validated* search, so
 * defaults filled in by `validateSearch` would reappear in the URL after every navigation; the
 * routes strip them again with `stripSearchParams(defaults)` (the `clearOnDefault` behaviour).
 */
export const orgAuditSearchDefaults = orgAuditSearchSchema.parse({});
export const platformAuditSearchDefaults = platformAuditSearchSchema.parse({});
export const userAuditSearchDefaults = userAuditSearchSchema.parse({});

export type OrgAuditSearch = ReturnType<typeof orgAuditSearchSchema.parse>;
export type PlatformAuditSearch = ReturnType<typeof platformAuditSearchSchema.parse>;
export type UserAuditSearch = ReturnType<typeof userAuditSearchSchema.parse>;

/** Route search to the `audit.list` input. */
export function toOrgAuditListInput(search: OrgAuditSearch) {
  return toListInput(orgAuditListInput, search);
}

/** Route search to the `audit.listPlatform` input. */
export function toPlatformAuditListInput(search: PlatformAuditSearch) {
  return toListInput(platformAuditListInput, search);
}

/** Route search to the `audit.listSelf` input. */
export function toUserAuditListInput(search: UserAuditSearch) {
  return toListInput(userAuditListInput, search);
}

/**
 * Route search of a page that hosts the user security log in one tab next to other content
 * (`/admin/users/$id`): the log's table keys plus `tab`. An unknown tab falls back to
 * `defaultTab`; unknown keys are stripped.
 */
export function createUserAuditTabSearchSchema<const TTab extends string>(
  tabs: readonly [TTab, ...TTab[]],
  defaultTab: NoInfer<TTab>,
) {
  return z.intersection(
    userAuditSearchSchema,
    z.object({ tab: z.enum(tabs).default(defaultTab).catch(defaultTab) }),
  );
}
