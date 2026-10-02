import { createListInput } from "@base-template/api/lib/list-input";
import { platformOrganizationsListConfig } from "@base-template/api/lib/platform-list-config";

import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { FilterVariant } from "@/shared/lib/data-table/types";

import { isFilterAccepted, toListInput } from "@/shared/lib/data-table/list-input";
import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";
import {
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "@/shared/lib/data-table/simple-filters";

const DEFAULT_SORT = [{ id: "createdAt", desc: true }] as const;

/** Server list input, built from the same allowlists as `platform.organizations.list`. */
export const organizationsListInput = createListInput(platformOrganizationsListConfig);

/** Simple mode (spec §6.2): `name` and `slug` are text filters; a test pins the ids to the server config. */
export const organizationsSearchConfig = {
  columnIds: ["name", "slug", "createdAt"],
  filterableColumnIds: ["name", "slug"],
  defaultSort: DEFAULT_SORT,
  defaultPerPage: 20,
} as const satisfies DataTableSearchConfig<"name" | "slug" | "createdAt", "name" | "slug">;

const ORGANIZATIONS_FILTER_VARIANTS = {
  name: "text",
  slug: "text",
} as const satisfies Record<string, FilterVariant>;

/** `validateSearch` of `/admin/organizations`. */
export const organizationsSearchSchema = createDataTableSearchSchema(
  organizationsSearchConfig,
).transform((search) =>
  normalizeSimpleSearch(search, ORGANIZATIONS_FILTER_VARIANTS, (filter) =>
    isFilterAccepted(organizationsListInput, filter),
  ),
);

export const organizationsSearchDefaults = organizationsSearchSchema.parse({});

export type OrganizationsSearch = ReturnType<typeof organizationsSearchSchema.parse>;

/** Route search to the `platform.organizations.list` input. */
export function toOrganizationsListInput(search: OrganizationsSearch) {
  return toListInput(organizationsListInput, {
    ...search,
    filters: simpleSearchToFilters(search, ORGANIZATIONS_FILTER_VARIANTS),
  });
}
