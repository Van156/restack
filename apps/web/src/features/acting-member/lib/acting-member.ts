import type { OfflineMaterial, OfflineSigner } from "./offline-pin-crypto";

/** The member who switched in on this device, as `staff.switchIn` answered. */
export type SwitchInResult = {
  memberId: string;
  name: string;
  role: string;
  locationId: string;
  actingToken: string;
  actingTokenExpiresAt: Date;
};

/** How an acting member's records are attributed: a server token, or a mac from the offline PIN. */
export type ActingCredential =
  | { kind: "token"; token: string }
  | { kind: "offline"; signer: OfflineSigner }
  /** The turn is over; nothing that could sign or attribute is kept. */
  | { kind: "ended" };

export type Acting = {
  memberId: string;
  name: string;
  role: string;
  locationId: string;
  credential: ActingCredential;
  expiresAt: Date;
};

/** A turn that began with an offline PIN lasts as long as an acting token does (the server's TTL). */
export const OFFLINE_TURN_MS = 15 * 60 * 1000;

export function toActing(result: SwitchInResult): Acting {
  return {
    memberId: result.memberId,
    name: result.name,
    role: result.role,
    locationId: result.locationId,
    credential: { kind: "token", token: result.actingToken },
    expiresAt: result.actingTokenExpiresAt,
  };
}

/** A member who typed the right PIN against the device's cached material. */
export function toOfflineActing(input: {
  material: OfflineMaterial;
  signer: OfflineSigner;
  locationId: string;
  now: Date;
}): Acting {
  const { material, signer } = input;
  return {
    memberId: material.memberId,
    name: material.name,
    role: material.role,
    locationId: input.locationId,
    credential: { kind: "offline", signer },
    expiresAt: new Date(input.now.getTime() + OFFLINE_TURN_MS),
  };
}

/** The same member after their turn: the signer (and so the offline key) is dropped. */
export function endedTurn(acting: Acting): Acting {
  return { ...acting, credential: { kind: "ended" } };
}

/** The acting token to pass on online calls; an offline turn has none. */
export function actingToken(acting: Acting | null): string | undefined {
  return acting?.credential.kind === "token" ? acting.credential.token : undefined;
}

/** Who is acting at `locationId` now: nobody once the turn expired or for another Location. */
export function activeActing(acting: Acting | null, now: Date, locationId: string): Acting | null {
  if (
    !acting ||
    acting.credential.kind === "ended" ||
    acting.locationId !== locationId ||
    now.getTime() >= acting.expiresAt.getTime()
  ) {
    return null;
  }
  return acting;
}

/** A Staff member of a Location as `staff.listAtLocation` returns them. */
export type StaffOption = {
  memberId: string;
  name: string;
  role: string;
  /** Holds `override:give` through a built-in or a custom Role. */
  canGiveOverride: boolean;
};

/** The Location's Staff by name. */
export function rosterOptions(roster: readonly StaffOption[]): StaffOption[] {
  return roster.toSorted((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Who may approve an Override here; the requester never approves their own. */
export function approverOptions(
  roster: readonly StaffOption[],
  requesterMemberId?: string,
): StaffOption[] {
  return rosterOptions(roster).filter(
    (option) => option.canGiveOverride && option.memberId !== requesterMemberId,
  );
}
