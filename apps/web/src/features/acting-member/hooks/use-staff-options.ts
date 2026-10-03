import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { useCached } from "@/shared/hooks/use-cached";
import { orgQueryKey } from "@/shared/lib/org-query-key";

import { approverOptions, rosterOptions, type StaffOption } from "../lib/acting-member";
import { createRosterCache, rosterKey } from "../lib/staff-roster";

/**
 * The Staff of one Location (`staff.listAtLocation`, custom Roles included), kept on the device so
 * the picker still lists them offline. `approvers` are those who can give an Override.
 */
export function useStaffOptions(locationId: string): {
  isPending: boolean;
  error: unknown;
  all: StaffOption[];
  approvers: (requesterMemberId?: string) => StaffOption[];
} {
  const { data: organization } = authClient.useActiveOrganization();
  const organizationId = organization?.id;
  const cache = useMemo(
    () =>
      createRosterCache(
        window.localStorage,
        rosterKey({ organizationId: organizationId ?? "", locationId }),
      ),
    [organizationId, locationId],
  );
  const query = useQuery({
    queryKey: orgQueryKey(organizationId, "staff-at-location", locationId),
    queryFn: () => client.restaurant.staff.listAtLocation({ locationId }),
    enabled: Boolean(organizationId),
  });
  const roster = useCached(
    query.data,
    () => cache.read(),
    (value) => cache.write(value),
  );
  return {
    isPending: query.isPending && !roster,
    error: query.error,
    all: useMemo(() => rosterOptions(roster ?? []), [roster]),
    approvers: (requesterMemberId) => approverOptions(roster ?? [], requesterMemberId),
  };
}
