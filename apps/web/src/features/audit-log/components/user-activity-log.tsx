import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { orpc } from "@/app/orpc";

import { toUserAuditListInput } from "../lib/audit-log-search";
import type { UserAuditSearch } from "../lib/audit-log-search";
import UserAuditLogSection from "./user-audit-log-section";

/**
 * Another user's security log for a superadmin (account-and-org-settings R7.2): `audit.listUser`,
 * which only the platform `audit:read` permission reaches. The caller (the admin user page) owns
 * the route search, so `onSearchChange` is a prop rather than a hard-coded route.
 */
export default function UserActivityLog({
  userId,
  search,
  onSearchChange,
}: {
  userId: string;
  search: UserAuditSearch;
  onSearchChange: DataTableSearchChange;
}) {
  const query = useQuery({
    ...orpc.audit.listUser.queryOptions({ input: { ...toUserAuditListInput(search), userId } }),
    placeholderData: keepPreviousData,
  });

  return (
    <UserAuditLogSection
      title="Activity"
      headingId="user-activity-heading"
      search={search}
      onSearchChange={onSearchChange}
      query={query}
      csvFilename="user-activity.csv"
    />
  );
}
