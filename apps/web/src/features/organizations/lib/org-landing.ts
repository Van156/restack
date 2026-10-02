import { betterAuthErrorMessage } from "@/features/auth";

export type OrgLandingDecision =
  | { type: "activate"; organizationId: string }
  | { type: "onboarding" }
  | { type: "error"; message: string };

/**
 * R10.2 / R11.4: where the user lands after leaving or deleting an organization: the first
 * remaining membership (activated, then the dashboard) or `/onboarding` when none is left. Pure so
 * it tests without a router. The exited organization is filtered out in case the list was served
 * from a stale cache, and a failed `organization.list()` is an error, never "zero organizations".
 */
export function decideOrgLanding(input: {
  organizations: { id: string }[] | null | undefined;
  listError: unknown;
  exitedOrganizationId: string;
}): OrgLandingDecision {
  if (input.listError) {
    return {
      type: "error",
      message: betterAuthErrorMessage(input.listError, "Could not load your organizations."),
    };
  }
  const remaining = (input.organizations ?? []).filter(
    (organization) => organization.id !== input.exitedOrganizationId,
  );
  if (remaining.length === 0) {
    return { type: "onboarding" };
  }
  return { type: "activate", organizationId: remaining[0].id };
}
