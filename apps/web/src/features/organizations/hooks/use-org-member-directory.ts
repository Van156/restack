import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/app/auth-client";
import { additionalMemberPageOffsets, isMemberDirectoryIncomplete } from "../lib/member-directory";
import { memberDirectoryQueryKey } from "../lib/org-query-keys";

export type OrgDirectoryMember = {
  id: string;
  userId: string;
  role: string;
  user?: { name?: string | null; email?: string | null };
};

const PAGE_SIZE = 100;
/** Most members resolved, bounding the `listMembers` round trips for a very large organization. */
const MAX_MEMBERS = 500;

/**
 * The active organization's members, paged past better-auth's 100-row limit, to name audit-log
 * actors and fill the actor filter. `isIncomplete` is true past `MAX_MEMBERS`: some actors then
 * show as a shortened id (`resolveActorLabel`).
 */
export function useOrgMemberDirectory(activeOrganizationId: string | undefined) {
  return useQuery({
    queryKey: memberDirectoryQueryKey(activeOrganizationId),
    queryFn: async (): Promise<{
      members: OrgDirectoryMember[];
      total: number;
      isIncomplete: boolean;
    }> => {
      const first = await authClient.organization.listMembers({
        query: { limit: PAGE_SIZE, offset: 0 },
      });
      if (first.error) {
        throw first.error;
      }
      const { total } = first.data;
      const offsets = additionalMemberPageOffsets(total, PAGE_SIZE, MAX_MEMBERS);
      const rest = await Promise.all(
        offsets.map(async (offset) => {
          const { data, error } = await authClient.organization.listMembers({
            query: { limit: PAGE_SIZE, offset },
          });
          if (error) {
            throw error;
          }
          return data.members;
        }),
      );
      return {
        members: [...first.data.members, ...rest.flat()],
        total,
        isIncomplete: isMemberDirectoryIncomplete(total, MAX_MEMBERS),
      };
    },
    enabled: Boolean(activeOrganizationId),
  });
}
