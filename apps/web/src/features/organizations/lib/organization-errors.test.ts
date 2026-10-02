import { describe, expect, test } from "bun:test";

import { isOrganizationLimitError, isSlugTakenError } from "./organization-errors";

function fetchError(code: string, message: string) {
  return { status: 400, statusText: "Bad Request", code, message };
}

describe("organization error predicates", () => {
  test("isOrganizationLimitError matches only its exact code (R1.1b)", () => {
    expect(
      isOrganizationLimitError(
        fetchError(
          "YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS",
          "You have reached the maximum number of organizations",
        ),
      ),
    ).toBe(true);
    expect(isOrganizationLimitError(fetchError("ORGANIZATION_SLUG_ALREADY_TAKEN", "x"))).toBe(
      false,
    );
    expect(isOrganizationLimitError(undefined)).toBe(false);
  });

  test("isSlugTakenError matches only its exact code (R1.2)", () => {
    expect(isSlugTakenError(fetchError("ORGANIZATION_SLUG_ALREADY_TAKEN", "x"))).toBe(true);
    expect(
      isSlugTakenError(fetchError("YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS", "x")),
    ).toBe(false);
  });
});
