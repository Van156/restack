import { authClient } from "@/app/auth-client";
import { isSuperadminRole } from "@/features/access-control";

import { resolveHasOrganization, type NavContext } from "./navigation";

/** The context the sidebar and section tabs evaluate their `visible` predicates with. */
export function useNavContext(): NavContext {
  const { data: session } = authClient.useSession();
  const { data: organizations, isPending, error } = authClient.useListOrganizations();
  return {
    isSuperadmin: isSuperadminRole(session?.user.role),
    hasOrganization: resolveHasOrganization({
      activeOrganizationId: session?.session.activeOrganizationId,
      organizationCount: organizations?.length,
      isLoading: isPending,
      hasError: Boolean(error),
    }),
  };
}
