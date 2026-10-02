import type { ClientListAccessors, ClientListState } from "@/shared/lib/data-table/client-list";
import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { FilterVariant, Option } from "@/shared/lib/data-table/types";

import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";
import {
  isBoundedStringFilter,
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "@/shared/lib/data-table/simple-filters";

import type { InvitationRow } from "../types";

/**
 * Client-side mode (data table spec §7): better-auth's `list-invitations` takes no paging, sort
 * or filter and returns every invitation of the organization, so the whole list is in memory and
 * the table sorts, filters and pages it locally (`applyClientList`). The search lives in
 * component state, not in the URL.
 */
export const invitationsSearchConfig = {
  columnIds: ["email", "role", "expiresAt"],
  filterableColumnIds: ["email", "role"],
  // Soonest expiry first is the order the invitations were sent in.
  defaultSort: [{ id: "expiresAt", desc: false }],
  defaultPerPage: 10,
} as const satisfies DataTableSearchConfig<"email" | "role" | "expiresAt", "email" | "role">;

const INVITATIONS_FILTER_VARIANTS = {
  email: "text",
  role: "select",
} as const satisfies Record<string, FilterVariant>;

/** Parses (and so normalizes) the table's search: the table state's only source of truth. */
export const invitationsSearchSchema = createDataTableSearchSchema(
  invitationsSearchConfig,
).transform((search) =>
  normalizeSimpleSearch(search, INVITATIONS_FILTER_VARIANTS, isBoundedStringFilter),
);

export const invitationsSearchDefaults = invitationsSearchSchema.parse({});

export type InvitationsSearch = ReturnType<typeof invitationsSearchSchema.parse>;

/** What `applyClientList` needs from a search: paging, sort and the simple filters as filters. */
export function toInvitationsListState(search: InvitationsSearch): ClientListState {
  return {
    page: search.page,
    perPage: search.perPage,
    sort: search.sort,
    filters: simpleSearchToFilters(search, INVITATIONS_FILTER_VARIANTS),
  };
}

/** How the invitations table reads a row to sort and filter it. */
export const invitationsAccessors: ClientListAccessors<InvitationRow> = {
  sort: {
    email: (invitation) => invitation.email,
    role: (invitation) => invitation.role,
    expiresAt: (invitation) => new Date(invitation.expiresAt).getTime(),
  },
  filter: {
    email: (invitation) => invitation.email,
    role: (invitation) => invitation.role,
  },
};

/** The role filter's options: the roles the listed invitations carry, each once, sorted. */
export function getInvitationRoleOptions(invitations: readonly InvitationRow[]): Option[] {
  return [...new Set(invitations.map((invitation) => invitation.role))]
    .toSorted()
    .map((role) => ({ label: role, value: role }));
}
