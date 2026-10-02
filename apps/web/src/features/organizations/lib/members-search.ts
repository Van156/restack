import { createListInput } from "@base-template/api/lib/list-input";
import { orgMembersListConfig } from "@base-template/api/lib/members-list-config";

import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { FilterVariant } from "@/shared/lib/data-table/types";

import { isFilterAccepted, toListInput } from "@/shared/lib/data-table/list-input";
import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";
import {
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "@/shared/lib/data-table/simple-filters";

/** Server list input, built from the same allowlists as `members.list`. */
export const membersListInput = createListInput(orgMembersListConfig);

/**
 * Simple mode (spec §6.2): one URL key per filterable column. Sortable and filterable ids mirror
 * `orgMembersListConfig`; a test pins them. Join order is the default so the list reads the way
 * it did before it was sortable.
 */
export const membersSearchConfig = {
  columnIds: ["name", "email", "role", "createdAt"],
  filterableColumnIds: ["name", "email", "role"],
  defaultSort: [{ id: "createdAt", desc: false }],
  defaultPerPage: 20,
} as const satisfies DataTableSearchConfig;

/** The columns the list can be sorted by, derived from `membersSearchConfig`. */
export type MembersSortColumn = (typeof membersSearchConfig.columnIds)[number];

/** How each filter key filters (the simple toolbar writes these variants' default operators). */
const MEMBERS_FILTER_VARIANTS = {
  name: "text",
  email: "text",
  role: "select",
} as const satisfies Record<string, FilterVariant>;

/**
 * `validateSearch` of `/settings/members`: always a search the server accepts. Role names are an
 * organization's own (custom roles), so any non-blank role is accepted.
 */
export const membersSearchSchema = createDataTableSearchSchema(membersSearchConfig).transform(
  (search) =>
    normalizeSimpleSearch(search, MEMBERS_FILTER_VARIANTS, (filter) =>
      isFilterAccepted(membersListInput, filter),
    ),
);

export const membersSearchDefaults = membersSearchSchema.parse({});

export type MembersSearch = ReturnType<typeof membersSearchSchema.parse>;

/** The `members.list` input for a route search; the active organization comes from the session. */
export function toMembersListInput(search: MembersSearch) {
  return toListInput(membersListInput, {
    ...search,
    filters: simpleSearchToFilters(search, MEMBERS_FILTER_VARIANTS),
  });
}

/** The input type of `members.list`. */
export type MembersListInput = ReturnType<typeof toMembersListInput>;
