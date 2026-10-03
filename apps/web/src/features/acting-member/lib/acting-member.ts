/** The member who switched in on this device, as `staff.switchIn` answered. */
export type SwitchInResult = {
  memberId: string;
  name: string;
  role: string;
  locationId: string;
  actingToken: string;
  actingTokenExpiresAt: Date;
};

export type Acting = {
  memberId: string;
  name: string;
  role: string;
  locationId: string;
  token: string;
  expiresAt: Date;
};

export function toActing(result: SwitchInResult): Acting {
  return {
    memberId: result.memberId,
    name: result.name,
    role: result.role,
    locationId: result.locationId,
    token: result.actingToken,
    expiresAt: result.actingTokenExpiresAt,
  };
}

/** Who is acting at `locationId` now: nobody once the token expired or for another Location. */
export function activeActing(acting: Acting | null, now: Date, locationId: string): Acting | null {
  if (!acting || acting.locationId !== locationId || now.getTime() >= acting.expiresAt.getTime()) {
    return null;
  }
  return acting;
}

export type DirectoryMember = {
  id: string;
  userId: string;
  role: string;
  user?: { name?: string | null; email?: string | null };
};

export type StaffOption = { memberId: string; name: string; role: string };

const roleNames = (role: string) => role.split(",").map((part) => part.trim());

/** Everyone in the organization, by name; the server refuses anyone not assigned to the Location. */
export function staffOptions(members: readonly DirectoryMember[]): StaffOption[] {
  return members
    .map((member) => ({
      memberId: member.id,
      name: member.user?.name || member.user?.email || "Sin nombre",
      role: member.role,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Owner and Administrators, who give Overrides; the requester never approves their own. */
export function approverOptions(
  members: readonly DirectoryMember[],
  requesterMemberId?: string,
): StaffOption[] {
  return staffOptions(members).filter(
    (option) =>
      option.memberId !== requesterMemberId &&
      roleNames(option.role).some((name) => name === "owner" || name === "admin"),
  );
}
