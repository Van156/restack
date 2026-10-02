import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { authClient } from "@/app/auth-client";
import { orpc } from "@/app/orpc";
import { UserActivityLog, userAuditSearchConfig } from "@/features/audit-log";
import { betterAuthErrorMessage } from "@/features/auth";
import Loader from "@/shared/components/feedback/loader";
import { mergeTableSearch } from "@/shared/lib/data-table/search";

import type { UserDetailSearch, UserDetailTab } from "../lib/user-detail-search";

import BanCard from "./ban-card";
import ImpersonateCard from "./impersonate-card";
import OrgLimitCard from "./org-limit-card";
import UserDetailTabs from "./user-detail-tabs";

/**
 * Platform user detail (docs/specs/auth-multitenant-rbac.md §7 `/admin/users/$id`, R6): org-limit
 * override (R6.6), ban/unban (R6.3), impersonate (R6.4) on the Details tab and the user's security
 * log (account-settings R7.2) on the Activity tab. Impersonation uses better-auth's client,
 * the rest oRPC (`platformRouter`); see docs/architecture/web-app.md#impersonation.
 */
export default function UserDetailPage({
  userId,
  search,
}: {
  userId: string;
  search: UserDetailSearch;
}) {
  const navigate = useNavigate({ from: "/admin/users/$id" });
  const { data: session } = authClient.useSession();
  const userQuery = useQuery(orpc.platform.users.get.queryOptions({ input: { userId } }));

  // Switching tab drops the other tab's table state.
  const onTabChange = useCallback(
    (tab: UserDetailTab) => void navigate({ search: { tab } }),
    [navigate],
  );

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

  if (userQuery.isPending) {
    return <Loader />;
  }
  if (userQuery.isError) {
    return (
      <p className="text-sm text-destructive">
        {betterAuthErrorMessage(userQuery.error, "Could not load this user.")}
      </p>
    );
  }

  const { user, defaultMaxOrganizationsPerUser } = userQuery.data;
  const isSelf = user.id === session?.user.id;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{user.name}</h2>
        <p className="text-sm text-muted-foreground">{user.email}</p>
        <p className="text-xs text-muted-foreground">Role: {user.role ?? "—"}</p>
      </div>

      <UserDetailTabs
        tab={search.tab}
        onTabChange={onTabChange}
        details={
          <div className="space-y-4">
            {/*
             * Keyed by user id: card state must not survive a change of `$id`.
             * See docs/architecture/web-app.md#admin-area.
             */}
            <OrgLimitCard
              key={user.id}
              userId={user.id}
              currentLimit={user.maxOrganizations}
              defaultLimit={defaultMaxOrganizationsPerUser}
            />

            <BanCard key={user.id} user={user} isSelf={isSelf} />

            <ImpersonateCard key={user.id} user={user} />
          </div>
        }
        activity={
          <UserActivityLog
            key={user.id}
            userId={user.id}
            search={search}
            onSearchChange={onSearchChange}
          />
        }
      />
    </div>
  );
}
