import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { orpc } from "@/app/orpc";
import { mergeTableSearch } from "@/shared/lib/data-table/search";

import { toUserAuditListInput, userAuditSearchConfig } from "../lib/audit-log-search";
import type { UserAuditSearch } from "../lib/audit-log-search";
import UserAuditLogSection from "./user-audit-log-section";

/**
 * The signed-in user's security log (account-and-org-settings R7.1): `audit.listSelf`, scoped to
 * the session user server-side, with sort, date and action filters and paging in the route search
 * of `/account/security`. Shares the table with the organization and platform logs.
 */
export default function SelfSecurityLog({ search }: { search: UserAuditSearch }) {
  const navigate = useNavigate({ from: "/account/security" });

  const query = useQuery({
    ...orpc.audit.listSelf.queryOptions({ input: toUserAuditListInput(search) }),
    placeholderData: keepPreviousData,
  });

  const onSearchChange = useCallback<DataTableSearchChange>(
    (next, { replace }) => {
      void navigate({
        search: (previous) =>
          mergeTableSearch(userAuditSearchConfig, previous, next) as typeof previous,
        replace,
      });
    },
    [navigate],
  );

  return (
    <UserAuditLogSection
      title="Security log"
      headingId="security-log-heading"
      search={search}
      onSearchChange={onSearchChange}
      query={query}
      csvFilename="security-log.csv"
    />
  );
}
