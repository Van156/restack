import { describe, expect, test } from "bun:test";

import { orgExitCopy } from "./org-exit";

describe("orgExitCopy", () => {
  test("a landing failure tells the user the exit itself succeeded", () => {
    expect(orgExitCopy("delete").landingFailure).toContain("was deleted");
    expect(orgExitCopy("leave").landingFailure).toContain("You left");
  });

  test("the failure copy never claims success", () => {
    expect(orgExitCopy("delete").failure).toStartWith("Could not");
    expect(orgExitCopy("leave").failure).toStartWith("Could not");
  });
});
