import { ACTIVE_MEMBER_ROLE_QUERY_ROOT, CAN_QUERY_ROOT } from "@/features/access-control";

import { MEMBERS_QUERY_ROOT } from "./members-query";

export const MEMBER_DIRECTORY_QUERY_ROOT = "org-member-directory";

/** Cache key of the paged member directory of one organization. */
export function memberDirectoryQueryKey(organizationId: string | undefined) {
  return [MEMBER_DIRECTORY_QUERY_ROOT, organizationId] as const;
}

/** Roots of every query backed by the active organization: dropped when the user exits it, refreshed when roles may have changed. */
export const ORG_SCOPED_QUERY_ROOTS = [
  MEMBERS_QUERY_ROOT,
  MEMBER_DIRECTORY_QUERY_ROOT,
  ACTIVE_MEMBER_ROLE_QUERY_ROOT,
  CAN_QUERY_ROOT,
] as const;
