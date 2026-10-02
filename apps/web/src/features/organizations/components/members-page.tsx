import { Button } from "@base-template/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";
import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";
import { client } from "@/app/orpc";
import { authClient } from "@/app/auth-client";
import { useCallerRoles, useCan } from "@/features/access-control";
import { betterAuthErrorMessage } from "@/features/auth";
import { mergeTableSearch } from "@/shared/lib/data-table/search";

import { useMemberMutations } from "../hooks/use-member-mutations";
import { useOrgExitMutation } from "../hooks/use-org-exit-mutation";
import { getRemoveMemberDialog, type RemovableMember } from "../lib/member-removal";
import { membersQueryKey, shouldKeepPreviousMembers } from "../lib/members-query";
import { membersSearchConfig, toMembersListInput, type MembersSearch } from "../lib/members-search";
import { getMembersColumns } from "./members-columns";

/**
 * Members settings (docs/specs/auth-multitenant-rbac.md §7 `/settings/members`, R3): list, change
 * a role, remove, leave. No page-level `CanGate` (any member may list, R3.1); the server enforces
 * last-owner (R3.4). See docs/architecture/web-app.md#permission-gated-pages.
 */
export default function MembersPage({ search }: { search: MembersSearch }) {
  const navigate = useNavigate({ from: "/settings/members" });
  const { data: session } = authClient.useSession();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const activeOrganizationId = activeOrganization?.id;

  const { can: canUpdateRole } = useCan("member:update");
  const { can: canRemove } = useCan("member:delete");

  const { roleCatalog, assignable } = useCallerRoles(activeOrganizationId);

  const [memberToRemove, setMemberToRemove] = useState<RemovableMember | null>(null);
  const input = toMembersListInput(search);
  const membersQuery = useQuery({
    // The key carries the organization (the server derives it from the session), so one
    // organization's cached rows are never shown for another.
    queryKey: membersQueryKey(activeOrganizationId, input),
    queryFn: () => client.members.list(input),
    enabled: Boolean(activeOrganizationId),
    // Paging, sorting and filtering keep the shown rows; switching organization does not.
    placeholderData: (previousData, previousQuery) =>
      shouldKeepPreviousMembers(previousQuery?.queryKey, activeOrganizationId)
        ? previousData
        : undefined,
  });

  const { updateRoleMutation, removeMemberMutation } = useMemberMutations();
  const leaveMutation = useOrgExitMutation("leave");

  const onSearchChange = useCallback<DataTableSearchChange>(
    (next, { replace }) => {
      void navigate({
        search: (previous) =>
          mergeTableSearch(membersSearchConfig, previous, next) as typeof previous,
        replace,
      });
    },
    [navigate],
  );

  const currentUserId = session?.user.id;
  const roleChangePendingId = updateRoleMutation.isPending
    ? updateRoleMutation.variables?.memberId
    : undefined;
  const removePendingId = removeMemberMutation.isPending
    ? removeMemberMutation.variables
    : undefined;
  const columns = useMemo(
    () =>
      getMembersColumns({
        roleOptions: roleCatalog.map((role) => ({ label: role.name, value: role.name })),
        assignableRoles: assignable,
        canUpdateRole,
        canRemove,
        currentUserId,
        roleChangePendingId,
        removePendingId,
        onChangeRole: (member, role) => updateRoleMutation.mutate({ memberId: member.id, role }),
        onRemove: (member) => setMemberToRemove(member),
      }),
    [
      updateRoleMutation.mutate,
      roleCatalog,
      assignable,
      canUpdateRole,
      canRemove,
      currentUserId,
      roleChangePendingId,
      removePendingId,
    ],
  );

  const total = membersQuery.data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} member{total === 1 ? "" : "s"}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (activeOrganizationId) {
              leaveMutation.mutate(activeOrganizationId);
            }
          }}
          disabled={leaveMutation.isPending || !activeOrganizationId}
        >
          {leaveMutation.isPending ? "Leaving..." : "Leave organization"}
        </Button>
      </div>

      <SimpleListTable
        search={search}
        searchConfig={membersSearchConfig}
        onSearchChange={onSearchChange}
        columns={columns}
        emptyTitle="No members found."
        list={{
          rows: membersQuery.data?.members,
          total: membersQuery.data?.total,
          isPending: membersQuery.isPending,
          isFetching: membersQuery.isFetching,
          isPlaceholderData: membersQuery.isPlaceholderData,
          errorMessage: membersQuery.isError
            ? betterAuthErrorMessage(membersQuery.error, "Could not load members.")
            : null,
          onRetry: () => void membersQuery.refetch(),
        }}
      />

      <ConfirmDialog
        open={memberToRemove !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMemberToRemove(null);
          }
        }}
        {...getRemoveMemberDialog(memberToRemove, (memberId) =>
          removeMemberMutation.mutateAsync(memberId),
        )}
      />
    </div>
  );
}
