import type { MembersListInput } from "./members-search";

export const MEMBERS_QUERY_ROOT = "org-members";

/** Cache key of the members list: scoped to the organization, then the list input. */
export function membersQueryKey(organizationId: string | undefined, input: MembersListInput) {
  return [MEMBERS_QUERY_ROOT, organizationId, input] as const;
}

/**
 * Whether the rows of the previous members query may stay on screen while the next one loads:
 * only inside one organization (page, sort and filter changes). After an organization switch
 * they belong to another organization and must give way to the loading state.
 */
export function shouldKeepPreviousMembers(
  previousKey: readonly unknown[] | undefined,
  organizationId: string | undefined,
): boolean {
  return previousKey !== undefined && previousKey[1] === organizationId;
}
