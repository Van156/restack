import { hasOwnerRole } from "@base-template/auth/owner-role";

type DirectoryMember = {
  id: string;
  userId: string;
  role: string;
  user?: { name?: string | null; email?: string | null };
};
type Assignment = { memberId: string; locationIds: string[] };
type LocationRef = { id: string; name: string };

export type StaffRow = {
  memberId: string;
  name: string;
  email: string;
  role: string;
  isOwner: boolean;
  locationIds: string[];
  /** In the order of `locations`, skipping ids the caller cannot see. */
  locationNames: string[];
};

/**
 * Members of the organization with the Locations they are assigned to (only those in the
 * caller's scope). The Owner has no assignment rows and works in every Location.
 */
export function buildStaffRows(
  members: readonly DirectoryMember[],
  assignments: readonly Assignment[],
  locations: readonly LocationRef[],
): StaffRow[] {
  const assigned = new Map(assignments.map((entry) => [entry.memberId, entry.locationIds]));
  return members
    .map((member) => {
      const locationIds = assigned.get(member.id) ?? [];
      return {
        memberId: member.id,
        name: member.user?.name ?? "",
        email: member.user?.email ?? "",
        role: member.role,
        isOwner: hasOwnerRole(member.role),
        locationIds,
        locationNames: locations
          .filter((location) => locationIds.includes(location.id))
          .map((location) => location.name),
      };
    })
    .sort((a, b) => {
      if ((a.name === "") !== (b.name === "")) {
        return a.name === "" ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });
}

/** UX-only: the server re-checks scope, and refuses Owner changes by anyone else. */
export function rowActions({
  callerIsOwner,
  row,
}: {
  callerIsOwner: boolean;
  row: { isOwner: boolean };
}): { canEditLocations: boolean; canResetPin: boolean } {
  return {
    canEditLocations: !row.isOwner,
    canResetPin: !row.isOwner || callerIsOwner,
  };
}
