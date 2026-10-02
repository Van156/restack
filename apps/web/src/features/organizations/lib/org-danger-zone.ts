import { hasOwnerRole } from "@base-template/auth/owner-role";

/** A member as the danger zone needs it: the directory row's identity and role. */
export type DangerZoneMember = {
  id: string;
  userId: string;
  role: string;
  user?: { name?: string | null; email?: string | null };
};

export type TransferCandidate = { id: string; label: string };

/** Display label for a member: name, then email, then the member id. */
export function memberLabel(member: DangerZoneMember): string {
  const name = member.user?.name?.trim();
  const email = member.user?.email?.trim();
  if (name && email) {
    return `${name} (${email})`;
  }
  return name || email || member.id;
}

/** R8.4: everyone but the caller may receive ownership, ordered by label. */
export function transferCandidates(
  members: DangerZoneMember[],
  currentUserId: string | undefined,
): TransferCandidate[] {
  return members
    .filter((member) => member.userId !== currentUserId)
    .map((member) => ({ id: member.id, label: memberLabel(member) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * R10.1: the caller is the only owner among the listed members. UX only: the server (R3.4) still
 * decides. An incomplete directory may hide other owners, which at worst shows the reason early.
 */
export function isLastOwner(members: DangerZoneMember[], currentUserId: string | undefined) {
  const owners = members.filter((member) => hasOwnerRole(member.role));
  return owners.length === 1 && owners[0].userId === currentUserId;
}

/**
 * Error code of an owner promotion past the per-user owned-organization limit. Web-side copy of
 * `TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS` in `packages/auth/src/org-limit.ts` (the source
 * of truth): that module imports the db schema, so the browser bundle must not import it.
 */
const TARGET_REACHED_ORG_LIMIT_CODE = "TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS";

/** What the danger zone can show, given what has loaded. */
export type DangerZoneView = "pending" | "directory-error" | "ready";

/**
 * Pending until the session, the caller's role and the member directory settle, so no role-gated
 * action flickers in. A failed directory is its own state: the last-owner status is unknown then,
 * and the picker has no members.
 */
export function dangerZoneView(input: {
  sessionPending: boolean;
  rolePending: boolean;
  directory: { isPending: boolean; isError: boolean };
}): DangerZoneView {
  if (input.sessionPending || input.rolePending) {
    return "pending";
  }
  if (input.directory.isError) {
    return "directory-error";
  }
  return input.directory.isPending ? "pending" : "ready";
}

const TRANSFER_FALLBACK = "Could not transfer ownership.";

const TRANSFER_ERROR_COPY: Record<string, string> = {
  [TARGET_REACHED_ORG_LIMIT_CODE]:
    "That member already owns the maximum number of organizations, so they cannot become an owner here.",
  FORBIDDEN: "Only an owner can transfer ownership of this organization.",
  NOT_FOUND: "That member is no longer part of this organization.",
  BAD_REQUEST: "That transfer is not valid. Pick another member and try again.",
  CONFLICT: "Ownership changed while you were transferring it. Refresh and try again.",
};

/** User-facing copy for a failed `organization.transferOwnership` call (an `ORPCError`, read by its `code`). */
export function transferOwnershipErrorMessage(error: unknown): string {
  const code = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
  return (typeof code === "string" ? TRANSFER_ERROR_COPY[code] : undefined) ?? TRANSFER_FALLBACK;
}
