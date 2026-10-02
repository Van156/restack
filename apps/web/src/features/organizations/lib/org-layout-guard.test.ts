import { describe, expect, test } from "bun:test";

import { decideOrgLayoutGuard } from "./org-layout-guard";

describe("decideOrgLayoutGuard (R1.4, T7 review follow-up a)", () => {
  test("a failed organization.list() surfaces an error, never a redirect to onboarding", () => {
    const decision = decideOrgLayoutGuard({
      organizations: null,
      listError: {
        status: 500,
        statusText: "Internal Server Error",
        code: "INTERNAL_SERVER_ERROR",
        message: "Database unavailable",
      },
    });
    expect(decision).toEqual({ type: "error", message: "Database unavailable" });
  });

  test("a failed list still errors even if the client happened to return an empty array", () => {
    const decision = decideOrgLayoutGuard({
      organizations: [],
      listError: { status: 500, statusText: "Internal Server Error", message: "Network error" },
    });
    expect(decision.type).toBe("error");
  });

  test("an error with no readable message falls back to a generic one", () => {
    const decision = decideOrgLayoutGuard({ organizations: null, listError: { status: 0 } });
    expect(decision).toEqual({ type: "error", message: "Could not load your organizations." });
  });

  test("no organizations (and no error) redirects to onboarding", () => {
    expect(decideOrgLayoutGuard({ organizations: [], listError: null })).toEqual({
      type: "redirect-onboarding",
    });
    expect(decideOrgLayoutGuard({ organizations: null, listError: undefined })).toEqual({
      type: "redirect-onboarding",
    });
  });

  test("at least one organization activates the first one", () => {
    const decision = decideOrgLayoutGuard({
      organizations: [{ id: "org-1" }, { id: "org-2" }],
      listError: null,
    });
    expect(decision).toEqual({ type: "activate", organizationId: "org-1" });
  });
});
