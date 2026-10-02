import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { orpc } from "@/app/orpc";
import { betterAuthErrorMessage } from "@/features/auth";
import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";
import { mergeTableSearch } from "@/shared/lib/data-table/search";

import { organizationsSearchConfig, toOrganizationsListInput } from "../lib/organizations-search";
import type { OrganizationsSearch } from "../lib/organizations-search";
import { getOrganizationsColumns } from "./organizations-columns";

/**
 * Platform organizations (docs/specs/auth-multitenant-rbac.md §7 `/admin/organizations`, R6.2):
 * sort, filter and paginate every organization via the URL search
 * (`platformRouter.organizations.list`). Read-only: the spec names no organization mutation.
 */
export default function OrganizationsPage({ search }: { search: OrganizationsSearch }) {
  const navigate = useNavigate({ from: "/admin/organizations" });
  const columns = useMemo(() => getOrganizationsColumns(), []);

  const organizationsQuery = useQuery({
    ...orpc.platform.organizations.list.queryOptions({ input: toOrganizationsListInput(search) }),
    placeholderData: keepPreviousData,
  });

  const onSearchChange = useCallback<DataTableSearchChange>(
    (next, { replace }) => {
      void navigate({
        search: (previous) =>
          mergeTableSearch(organizationsSearchConfig, previous, next) as typeof previous,
        replace,
      });
    },
    [navigate],
  );

  return (
    <div className="space-y-4">
      <SimpleListTable
        search={search}
        searchConfig={organizationsSearchConfig}
        onSearchChange={onSearchChange}
        columns={columns}
        emptyTitle="No organizations found."
        list={{
          rows: organizationsQuery.data?.entries,
          total: organizationsQuery.data?.total,
          isPending: organizationsQuery.isPending,
          isFetching: organizationsQuery.isFetching,
          isPlaceholderData: organizationsQuery.isPlaceholderData,
          errorMessage: organizationsQuery.isError
            ? betterAuthErrorMessage(organizationsQuery.error, "Could not load organizations.")
            : null,
          onRetry: () => void organizationsQuery.refetch(),
        }}
      />
    </div>
  );
}
