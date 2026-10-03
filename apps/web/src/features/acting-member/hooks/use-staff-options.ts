import { useMemo } from "react";

import { authClient } from "@/app/auth-client";
import { useOrgMemberDirectory } from "@/features/organizations";

import { approverOptions, staffOptions, type StaffOption } from "../lib/acting-member";

/** People to pick in a PIN prompt, and the Administrators among them who may give Overrides. */
export function useStaffOptions(): {
  isPending: boolean;
  error: unknown;
  all: StaffOption[];
  approvers: (requesterMemberId?: string) => StaffOption[];
} {
  const { data: organization } = authClient.useActiveOrganization();
  const directory = useOrgMemberDirectory(organization?.id);
  const members = useMemo(() => directory.data?.members ?? [], [directory.data]);
  return {
    isPending: directory.isPending,
    error: directory.error,
    all: useMemo(() => staffOptions(members), [members]),
    approvers: (requesterMemberId) => approverOptions(members, requesterMemberId),
  };
}
