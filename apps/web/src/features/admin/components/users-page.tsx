import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { orpc } from "@/app/orpc";
import { betterAuthErrorMessage } from "@/features/auth";
import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";
import { mergeTableSearch } from "@/shared/lib/data-table/search";

import { toUsersListInput, usersSearchConfig } from "../lib/users-search";
import type { UsersSearch } from "../lib/users-search";
import { getUsersColumns } from "./users-columns";

/**
 * Platform users (docs/specs/auth-multitenant-rbac.md §7 `/admin/users`, R6.2): sort, filter and
 * paginate every user via the URL search (`platformRouter.users.list`). Each row links to
 * `/admin/users/$id` for the per-user actions (R6.3, R6.4, R6.6).
 */
export default function UsersPage({ search }: { search: UsersSearch }) {
  const navigate = useNavigate({ from: "/admin/users" });
  const columns = useMemo(() => getUsersColumns(), []);

  const usersQuery = useQuery({
    ...orpc.platform.users.list.queryOptions({ input: toUsersListInput(search) }),
    placeholderData: keepPreviousData,
  });

  const onSearchChange = useCallback<DataTableSearchChange>(
    (next, { replace }) => {
      void navigate({
        search: (previous) =>
          mergeTableSearch(usersSearchConfig, previous, next) as typeof previous,
        replace,
      });
    },
    [navigate],
  );

  return (
    <div className="space-y-4">
      <SimpleListTable
        search={search}
        searchConfig={usersSearchConfig}
        onSearchChange={onSearchChange}
        columns={columns}
        emptyTitle="No users found."
        list={{
          rows: usersQuery.data?.users,
          total: usersQuery.data?.total,
          isPending: usersQuery.isPending,
          isFetching: usersQuery.isFetching,
          isPlaceholderData: usersQuery.isPlaceholderData,
          errorMessage: usersQuery.isError
            ? betterAuthErrorMessage(usersQuery.error, "Could not load users.")
            : null,
          onRetry: () => void usersQuery.refetch(),
        }}
      />
    </div>
  );
}
