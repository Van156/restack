import { describe, expect, test } from "bun:test";

import {
  changePasswordErrorMessage,
  isCannotRevokeCurrentSessionError,
  revokeSessionErrorMessage,
} from "./security-errors";

describe("changePasswordErrorMessage", () => {
  test("explains a wrong current password", () => {
    expect(
      changePasswordErrorMessage({
        status: 400,
        code: "INVALID_PASSWORD",
        message: "Invalid password",
      }),
    ).toBe("Your current password is incorrect.");
  });

  test("uses the API message for other API errors", () => {
    expect(changePasswordErrorMessage({ status: 429, message: "Too many requests" })).toBe(
      "Too many requests",
    );
  });

  test("falls back for thrown errors", () => {
    expect(changePasswordErrorMessage(new Error("network"))).toBe(
      "Could not change your password.",
    );
  });
});

describe("revoke session errors", () => {
  const refusal = { status: 400, code: "CANNOT_REVOKE_CURRENT_SESSION", message: "x" };

  test("recognizes the current-session refusal", () => {
    expect(isCannotRevokeCurrentSessionError(refusal)).toBe(true);
    expect(isCannotRevokeCurrentSessionError({ status: 400, code: "OTHER" })).toBe(false);
    expect(isCannotRevokeCurrentSessionError(new Error("x"))).toBe(false);
  });

  test("maps the refusal to a specific message and others to the API message", () => {
    expect(revokeSessionErrorMessage(refusal)).toContain("session you are using");
    expect(revokeSessionErrorMessage({ status: 500, message: "Boom" })).toBe("Boom");
    expect(revokeSessionErrorMessage(null)).toBe("Could not sign out that session.");
  });
});
