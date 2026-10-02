import { describe, expect, test } from "bun:test";

import { decideOrgLanding } from "./org-landing";

describe("decideOrgLanding (R10.2, R11.4)", () => {
  test("activates the first remaining organization", () => {
    expect(
      decideOrgLanding({
        organizations: [{ id: "org_b" }, { id: "org_c" }],
        listError: null,
        exitedOrganizationId: "org_a",
      }),
    ).toEqual({ type: "activate", organizationId: "org_b" });
  });

  test("never lands on the organization just exited, even from a stale list", () => {
    expect(
      decideOrgLanding({
        organizations: [{ id: "org_a" }, { id: "org_c" }],
        listError: null,
        exitedOrganizationId: "org_a",
      }),
    ).toEqual({ type: "activate", organizationId: "org_c" });
  });

  test("goes to onboarding when no organization remains", () => {
    expect(
      decideOrgLanding({ organizations: [], listError: null, exitedOrganizationId: "org_a" }),
    ).toEqual({ type: "onboarding" });
    expect(
      decideOrgLanding({
        organizations: [{ id: "org_a" }],
        listError: null,
        exitedOrganizationId: "org_a",
      }),
    ).toEqual({ type: "onboarding" });
    expect(
      decideOrgLanding({ organizations: null, listError: null, exitedOrganizationId: "org_a" }),
    ).toEqual({ type: "onboarding" });
  });

  test("a failed list is an error, never onboarding", () => {
    expect(
      decideOrgLanding({
        organizations: [],
        listError: { status: 500, statusText: "Internal Server Error", message: "Boom" },
        exitedOrganizationId: "org_a",
      }),
    ).toEqual({ type: "error", message: "Boom" });
  });
});
