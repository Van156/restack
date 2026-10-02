import { hasOwnerRole } from "@base-template/auth/owner-role";

import { authClient } from "@/app/auth-client";
import { useActiveMemberRole, useCan } from "@/features/access-control";

import { useOrgLifecycleMutations } from "../hooks/use-org-lifecycle-mutations";
import { useOrgMemberDirectory } from "../hooks/use-org-member-directory";
import { dangerZoneView, isLastOwner, transferCandidates } from "../lib/org-danger-zone";
import OrgDangerZone, { OrgDangerZoneSkeleton } from "./org-danger-zone";

/**
 * Container for the General page danger zone. Rendered for every member (leave, R10.1); transfer is
 * offered to owners (R8.4) and delete to `organization:delete` holders (R11.1). UX only: the server
 * re-checks each action. A skeleton shows until the session, role and member directory settle; a
 * failed directory shows a retry and withholds transfer and leave (last-owner status unknown).
 */
export default function OrgDangerZoneSection({
  organization,
}: {
  organization: { id: string; name: string };
}) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const currentUserId = session?.user.id;
  const memberRole = useActiveMemberRole(organization.id);
  const { can: canDelete } = useCan("organization:delete");
  const directory = useOrgMemberDirectory(organization.id);
  const { transferMutation, leaveMutation, deleteMutation } = useOrgLifecycleMutations({
    organizationId: organization.id,
  });

  const view = dangerZoneView({
    sessionPending,
    rolePending: memberRole.isPending,
    directory: { isPending: directory.isPending, isError: directory.isError },
  });
  if (view === "pending") {
    return <OrgDangerZoneSkeleton />;
  }

  const members = directory.data?.members ?? [];
  const isOwner = memberRole.data !== undefined && hasOwnerRole(memberRole.data);

  return (
    <OrgDangerZone
      organizationName={organization.name}
      canTransfer={isOwner}
      canDelete={canDelete}
      directory={
        view === "directory-error"
          ? { status: "error", onRetry: () => void directory.refetch() }
          : {
              status: "ready",
              transferCandidates: transferCandidates(members, currentUserId),
              isLastOwner: isLastOwner(members, currentUserId),
            }
      }
      onTransfer={async (memberId) => {
        await transferMutation.mutateAsync(memberId);
      }}
      onLeave={async () => {
        await leaveMutation.mutateAsync(organization.id);
      }}
      onDelete={async () => {
        await deleteMutation.mutateAsync(organization.id);
      }}
    />
  );
}
