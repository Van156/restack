import { describe, expect, test } from "bun:test";

import { OAUTH_FALLBACK_MESSAGE, oauthErrorMessage } from "./oauth-error";

describe("oauthErrorMessage", () => {
  test("returns null without an error param", () => {
    expect(oauthErrorMessage(undefined)).toBeNull();
    expect(oauthErrorMessage("")).toBeNull();
  });

  test("maps known codes to fixed messages", () => {
    expect(oauthErrorMessage("account_not_linked")).toContain("already exists");
    expect(oauthErrorMessage("INVITATION_EMAIL_MISMATCH")).toContain("invitation");
    expect(oauthErrorMessage("access_denied")).toContain("cancelled");
  });

  test("falls back for unknown codes", () => {
    expect(oauthErrorMessage("something_else")).toBe(OAUTH_FALLBACK_MESSAGE);
  });
});
