import { betterAuthErrorCode } from "@/features/auth";

/** R1.1b: the caller has reached their effective organization-ownership limit. */
export function isOrganizationLimitError(error: unknown): boolean {
  return betterAuthErrorCode(error) === "YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS";
}

/** R1.2: the requested organization slug is already taken. */
export function isSlugTakenError(error: unknown): boolean {
  return betterAuthErrorCode(error) === "ORGANIZATION_SLUG_ALREADY_TAKEN";
}
