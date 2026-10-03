import { hasOwnerRole } from "@base-template/auth/owner-role";

import { authClient } from "@/app/auth-client";
import { useActiveMemberRole } from "@/features/access-control";

/** UX-only: whether the caller is the Owner; the server decides every Owner-only action. */
export function useIsOwner(): boolean {
  const { data: organization } = authClient.useActiveOrganization();
  const { data: role } = useActiveMemberRole(organization?.id);
  return role !== undefined && hasOwnerRole(role);
}
