// Allowlists of the organization members list input (spec §7). Pure data shared by the oRPC
// procedure (`createListInput`) and the web table (columns, route search), so the columns the UI
// offers are exactly the ones the server accepts.
import type { ListInputConfig } from "./list-input";

/**
 * Organization members (`members.list`). Name and email come from the member's `user` row and
 * are searched case-insensitively; `role` is an exact match on the member's role. Role names are
 * the organization's own (custom roles), so the filter accepts any string. Oldest member first
 * by default (join order).
 */
export const orgMembersListConfig = {
  sortableColumns: ["name", "email", "role", "createdAt"],
  filterableColumns: {
    name: "text",
    email: "text",
    role: "select",
  },
  defaultSort: [{ id: "createdAt", desc: false }],
} as const satisfies ListInputConfig<string, string>;
