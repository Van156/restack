import { betterAuthErrorBody, betterAuthErrorCode } from "@/features/auth";

export type BlockingOrganization = { id: string; name: string };

export type LastOwnerBlock = { message: string; organizations: BlockingOrganization[] };

const LAST_OWNER_FALLBACK =
  "You are the last owner of one or more organizations. Transfer ownership or delete those organizations first.";

/**
 * R6.1: the server refuses a delete request with `409 USER_IS_LAST_OWNER` and the organizations the
 * user is the last owner of. The client error is flat (the API body spread with `status`), so the
 * list sits on `error.organizations`. Returns `null` for any other error; malformed entries are
 * dropped rather than rendered.
 */
export function parseLastOwnerError(error: unknown): LastOwnerBlock | null {
  if (betterAuthErrorCode(error) !== "USER_IS_LAST_OWNER") {
    return null;
  }
  const body = betterAuthErrorBody(error) as { message?: unknown; organizations?: unknown };
  const organizations = Array.isArray(body.organizations)
    ? body.organizations.filter(isBlockingOrganization)
    : [];
  return {
    message: typeof body.message === "string" && body.message ? body.message : LAST_OWNER_FALLBACK,
    organizations,
  };
}

function isBlockingOrganization(value: unknown): value is BlockingOrganization {
  if (!value || typeof value !== "object") {
    return false;
  }
  const { id, name } = value as { id?: unknown; name?: unknown };
  return typeof id === "string" && typeof name === "string";
}
