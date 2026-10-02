import { createListInput } from "@base-template/api/lib/list-input";
import { platformUsersListConfig } from "@base-template/api/lib/platform-list-config";

import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { FilterVariant } from "@/shared/lib/data-table/types";

import { isFilterAccepted, toListInput } from "@/shared/lib/data-table/list-input";
import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";
import {
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "@/shared/lib/data-table/simple-filters";

const DEFAULT_SORT = [{ id: "createdAt", desc: true }] as const;

/** Server list input, built from the same allowlists as `platform.users.list`. */
export const usersListInput = createListInput(platformUsersListConfig);

/**
 * Simple mode (spec §6.2): one URL key per filterable column. Sortable ids and filterable ids
 * mirror `platformUsersListConfig`; a test pins them.
 */
export const usersSearchConfig = {
  columnIds: ["email", "name", "role", "createdAt"],
  filterableColumnIds: ["email", "name", "role", "status"],
  defaultSort: DEFAULT_SORT,
  defaultPerPage: 20,
} as const satisfies DataTableSearchConfig<
  "email" | "name" | "role" | "createdAt",
  "email" | "name" | "role" | "status"
>;

/** How each filter key filters (the simple toolbar writes these variants' default operators). */
const USERS_FILTER_VARIANTS = {
  email: "text",
  name: "text",
  role: "select",
  status: "select",
} as const satisfies Record<string, FilterVariant>;

/** `validateSearch` of `/admin/users`: always a search the server accepts. */
export const usersSearchSchema = createDataTableSearchSchema(usersSearchConfig).transform(
  (search) =>
    normalizeSimpleSearch(search, USERS_FILTER_VARIANTS, (filter) =>
      isFilterAccepted(usersListInput, filter),
    ),
);

export const usersSearchDefaults = usersSearchSchema.parse({});

export type UsersSearch = ReturnType<typeof usersSearchSchema.parse>;

/** Route search to the `platform.users.list` input. */
export function toUsersListInput(search: UsersSearch) {
  return toListInput(usersListInput, {
    ...search,
    filters: simpleSearchToFilters(search, USERS_FILTER_VARIANTS),
  });
}
