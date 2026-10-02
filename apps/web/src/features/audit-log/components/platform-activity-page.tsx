import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { orpc } from "@/app/orpc";
import { betterAuthErrorMessage } from "@/features/auth";
import { mergeTableSearch } from "@/shared/lib/data-table/search";

import { getPlatformAuditCsvColumns } from "../lib/audit-log-export";
import { platformAuditSearchConfig, toPlatformAuditListInput } from "../lib/audit-log-search";
import type { PlatformAuditSearch } from "../lib/audit-log-search";
import { getPlatformAuditColumns } from "./audit-log-columns";
import { AuditLogTable } from "./audit-log-table";

/**
 * Platform activity log (docs/specs/auth-multitenant-rbac.md §7 `/admin/activity`, R7.5): every
 * `audit_log` entry across organizations (`audit.listPlatform`), sharing table, helpers and
 * allowlists with the org page. See docs/architecture/web-app.md#audit-log-pages.
 */
export default function PlatformActivityPage({ search }: { search: PlatformAuditSearch }) {
  const navigate = useNavigate({ from: "/admin/activity" });
  const columns = useMemo(() => getPlatformAuditColumns(), []);
  const csvColumns = useMemo(() => getPlatformAuditCsvColumns(), []);

  const input = toPlatformAuditListInput(search);
  const activityQuery = useQuery({
    ...orpc.audit.listPlatform.queryOptions({ input }),
    placeholderData: keepPreviousData,
  });

  const onSearchChange = useCallback<DataTableSearchChange>(
    (next, { replace }) => {
      void navigate({
        search: (previous) =>
          mergeTableSearch(platformAuditSearchConfig, previous, next) as typeof previous,
        replace,
      });
    },
    [navigate],
  );

  return (
    <div className="space-y-4">
      <AuditLogTable
        search={search}
        searchConfig={platformAuditSearchConfig}
        onSearchChange={onSearchChange}
        columns={columns}
        csvColumns={csvColumns}
        csvFilename="platform-activity.csv"
        queryKey={JSON.stringify(input)}
        list={{
          rows: activityQuery.data?.rows,
          total: activityQuery.data?.total,
          isPending: activityQuery.isPending,
          isFetching: activityQuery.isFetching,
          isPlaceholderData: activityQuery.isPlaceholderData,
          errorMessage: activityQuery.isError
            ? betterAuthErrorMessage(
                activityQuery.error,
                "Could not load the platform activity log.",
              )
            : null,
          onRetry: () => void activityQuery.refetch(),
        }}
      />
    </div>
  );
}
