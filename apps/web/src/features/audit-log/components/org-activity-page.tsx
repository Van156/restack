import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { authClient } from "@/app/auth-client";
import { orpc } from "@/app/orpc";
import { CanGate } from "@/features/access-control";
import { betterAuthErrorMessage } from "@/features/auth";
import { useOrgMemberDirectory } from "@/features/organizations";
import { mergeTableSearch } from "@/shared/lib/data-table/search";

import { getOrgAuditCsvColumns } from "../lib/audit-log-export";
import { orgAuditSearchConfig, toOrgAuditListInput } from "../lib/audit-log-search";
import type { OrgAuditSearch } from "../lib/audit-log-search";
import { getOrgAuditColumns } from "./audit-log-columns";
import { AuditLogTable } from "./audit-log-table";

/**
 * Organization activity log (docs/specs/auth-multitenant-rbac.md §7 `/settings/activity`, R7.4):
 * `audit.list`, scoped server-side to `ctx.org.id`, so it can never show another tenant's log.
 * See docs/architecture/web-app.md#audit-log-pages.
 */
export default function OrgActivityPage({ search }: { search: OrgAuditSearch }) {
  return (
    <CanGate
      permission="audit:read"
      message="You don't have permission to view this organization's activity log."
    >
      <ActivityContent search={search} />
    </CanGate>
  );
}

function ActivityContent({ search }: { search: OrgAuditSearch }) {
  const navigate = useNavigate({ from: "/settings/activity" });
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const activeOrganizationId = activeOrganization?.id;

  // Members back the actor filter and resolve actor ids to names. Paginated past better-auth's
  // 100-row page size and capped, with an `isIncomplete` flag surfaced below.
  const memberDirectory = useOrgMemberDirectory(activeOrganizationId);
  const members = useMemo(() => memberDirectory.data?.members ?? [], [memberDirectory.data]);
  const columns = useMemo(() => getOrgAuditColumns(members), [members]);
  const csvColumns = useMemo(() => getOrgAuditCsvColumns(members), [members]);

  const input = toOrgAuditListInput(search);
  const activityQuery = useQuery({
    ...orpc.audit.list.queryOptions({ input, enabled: Boolean(activeOrganizationId) }),
    placeholderData: keepPreviousData,
  });

  const onSearchChange = useCallback<DataTableSearchChange>(
    (next, { replace }) => {
      void navigate({
        search: (previous) =>
          mergeTableSearch(orgAuditSearchConfig, previous, next) as typeof previous,
        replace,
      });
    },
    [navigate],
  );

  return (
    <div className="space-y-4">
      {memberDirectory.data?.isIncomplete ? (
        <p className="text-xs text-muted-foreground">
          This organization has {memberDirectory.data.total} members; actor names are resolved for
          the first {members.length} only — others may show as a shortened id.
        </p>
      ) : null}
      <AuditLogTable
        search={search}
        searchConfig={orgAuditSearchConfig}
        onSearchChange={onSearchChange}
        columns={columns}
        csvColumns={csvColumns}
        csvFilename="organization-activity.csv"
        queryKey={JSON.stringify(input)}
        list={{
          rows: activityQuery.data?.rows,
          total: activityQuery.data?.total,
          isPending: activityQuery.isPending,
          isFetching: activityQuery.isFetching,
          isPlaceholderData: activityQuery.isPlaceholderData,
          errorMessage: activityQuery.isError
            ? betterAuthErrorMessage(activityQuery.error, "Could not load the activity log.")
            : null,
          onRetry: () => void activityQuery.refetch(),
        }}
      />
    </div>
  );
}
