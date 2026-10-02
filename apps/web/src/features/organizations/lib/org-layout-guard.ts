import { betterAuthErrorMessage } from "@/features/auth";

export type OrgLayoutGuardDecision =
  | { type: "activate"; organizationId: string }
  | { type: "redirect-onboarding" }
  | { type: "error"; message: string };

/**
 * R1.4: the branching of `_auth/_org`'s `beforeLoad` once the session has no active organization,
 * pure so it tests without a router. A failed `organization.list()` is an error, never "zero
 * organizations" (which would send the user to onboarding).
 */
export function decideOrgLayoutGuard(input: {
  organizations: { id: string }[] | null | undefined;
  listError: unknown;
}): OrgLayoutGuardDecision {
  if (input.listError) {
    return {
      type: "error",
      message: betterAuthErrorMessage(input.listError, "Could not load your organizations."),
    };
  }
  if (!input.organizations || input.organizations.length === 0) {
    return { type: "redirect-onboarding" };
  }
  return { type: "activate", organizationId: input.organizations[0].id };
}
