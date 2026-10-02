import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { betterAuthErrorMessage } from "@/features/auth";

import { getUserAuditCsvColumns } from "../lib/audit-log-export";
import { toUserAuditListInput, userAuditSearchConfig } from "../lib/audit-log-search";
import type { UserAuditSearch } from "../lib/audit-log-search";
import { getUserAuditColumns, type UserAuditLogRow } from "./audit-log-columns";
import { AuditLogTable } from "./audit-log-table";

/**
 * A user's security log table (account-and-org-settings R7): the same columns, search state and
 * export for the self view (`audit.listSelf`) and the admin view (`audit.listUser`). The caller
 * owns the query and where the search state lives; this only renders them.
 */
export default function UserAuditLogSection({
  title,
  headingId,
  search,
  onSearchChange,
  query,
  csvFilename,
}: {
  title: string;
  headingId: string;
  search: UserAuditSearch;
  onSearchChange: DataTableSearchChange;
  query: UseQueryResult<{ rows: UserAuditLogRow[]; total: number }>;
  csvFilename: string;
}) {
  const columns = useMemo(() => getUserAuditColumns(), []);
  const csvColumns = useMemo(() => getUserAuditCsvColumns(), []);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} className="text-lg font-semibold">
        {title}
      </h2>
      <AuditLogTable
        search={search}
        searchConfig={userAuditSearchConfig}
        onSearchChange={onSearchChange}
        columns={columns}
        csvColumns={csvColumns}
        csvFilename={csvFilename}
        queryKey={JSON.stringify(toUserAuditListInput(search))}
        list={{
          rows: query.data?.rows,
          total: query.data?.total,
          isPending: query.isPending,
          isFetching: query.isFetching,
          isPlaceholderData: query.isPlaceholderData,
          errorMessage: query.isError
            ? betterAuthErrorMessage(query.error, "Could not load the security log.")
            : null,
          onRetry: () => void query.refetch(),
        }}
      />
    </section>
  );
}
