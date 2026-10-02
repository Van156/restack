import { describe, expect, test } from "bun:test";

import { shouldShowImpersonationBanner } from "./impersonation-banner";

describe("shouldShowImpersonationBanner (R6.4)", () => {
  test("no impersonatedBy: hidden", () => {
    expect(shouldShowImpersonationBanner(null)).toBe(false);
    expect(shouldShowImpersonationBanner(undefined)).toBe(false);
  });

  test("an impersonatedBy user id: shown", () => {
    expect(shouldShowImpersonationBanner("superadmin-user-id")).toBe(true);
  });
});
