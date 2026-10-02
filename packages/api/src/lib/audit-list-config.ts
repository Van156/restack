// Allowlists of the audit log list inputs (spec §7). Pure data shared by the oRPC procedures
// (`createListInput`) and the web table (columns, route search), so the columns the UI offers
// are exactly the ones the server accepts.
import {
  ORGANIZATION_AUDIT_ACTIONS,
  PLATFORM_AUDIT_ACTIONS,
  USER_AUDIT_ACTIONS,
} from "@base-template/auth/audit/actions";

import type { ListInputConfig } from "./list-input";

/** Scopes the platform log can filter by. `user` rows are never part of it (read per user instead). */
export const AUDIT_SCOPES = ["organization", "platform"] as const;

/** Actions an organization's log can contain. */
export const ORG_LOG_ACTIONS = ORGANIZATION_AUDIT_ACTIONS;

/** Actions the platform log can contain: both scopes. */
export const PLATFORM_LOG_ACTIONS = [
  ...ORGANIZATION_AUDIT_ACTIONS,
  ...PLATFORM_AUDIT_ACTIONS,
] as const;

/** Actions a user's security log can contain. */
export const USER_LOG_ACTIONS = USER_AUDIT_ACTIONS;

const DEFAULT_SORT = [{ id: "createdAt", desc: true }] as const;

/**
 * Organization log (`audit.list`). Column ids belong to this list contract (the web columns and
 * `AUDIT_LOG_LIST_COLUMNS` in `@base-template/auth` both follow them); `actor` is the actor's user
 * id (a picker over the organization's members). Sorting by an id column (actor) is not offered.
 */
export const orgAuditListConfig = {
  sortableColumns: ["createdAt", "action", "targetType"],
  filterableColumns: {
    createdAt: "date",
    action: { variant: "select", options: ORG_LOG_ACTIONS },
    actor: "select",
    targetType: "text",
  },
  defaultSort: DEFAULT_SORT,
} as const satisfies ListInputConfig<string, string>;

/** Platform log (`audit.listPlatform`): both scopes, every organization. */
export const platformAuditListConfig = {
  sortableColumns: ["createdAt", "scope", "action", "targetType"],
  filterableColumns: {
    createdAt: "date",
    scope: { variant: "select", options: AUDIT_SCOPES },
    organization: "text",
    actor: "text",
    action: { variant: "select", options: PLATFORM_LOG_ACTIONS },
    targetType: "text",
  },
  defaultSort: DEFAULT_SORT,
} as const satisfies ListInputConfig<string, string>;

/**
 * User security log (`audit.listSelf`, `audit.listUser`): one user's own events. The user is never
 * a filter (the procedure fixes it), so the table only narrows by date and action.
 */
export const userAuditListConfig = {
  sortableColumns: ["createdAt", "action"],
  filterableColumns: {
    createdAt: "date",
    action: { variant: "select", options: USER_LOG_ACTIONS },
  },
  defaultSort: DEFAULT_SORT,
} as const satisfies ListInputConfig<string, string>;
