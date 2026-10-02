/** Ways of leaving an organization for good: the caller leaves it, or an owner deletes it. */
export type OrgExit = "leave" | "delete";

const ORG_EXIT_COPY: Record<OrgExit, { success: string; failure: string; landingFailure: string }> =
  {
    leave: {
      success: "You left the organization",
      failure: "Could not leave the organization.",
      landingFailure:
        "You left the organization, but we could not open the next page. Reload to continue.",
    },
    delete: {
      success: "Organization deleted",
      failure: "Could not delete the organization.",
      landingFailure:
        "The organization was deleted, but we could not open the next page. Reload to continue.",
    },
  };

export function orgExitCopy(exit: OrgExit) {
  return ORG_EXIT_COPY[exit];
}
