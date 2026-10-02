import { describe, expect, test } from "bun:test";

import { isInvalidResetTokenError } from "./reset-password-error";

describe("isInvalidResetTokenError", () => {
  test("is true for the better-auth INVALID_TOKEN error", () => {
    expect(isInvalidResetTokenError({ code: "INVALID_TOKEN", status: 400 })).toBe(true);
  });

  test("is false for other 400 errors such as a too-short password", () => {
    expect(isInvalidResetTokenError({ code: "PASSWORD_TOO_SHORT", status: 400 })).toBe(false);
  });

  test("is false for rate limiting and server errors", () => {
    expect(isInvalidResetTokenError({ status: 429, statusText: "Too Many Requests" })).toBe(false);
    expect(isInvalidResetTokenError({ status: 500, statusText: "Internal Server Error" })).toBe(
      false,
    );
  });

  test("is false for thrown errors and non-objects", () => {
    expect(isInvalidResetTokenError(new Error("Failed to fetch"))).toBe(false);
    expect(isInvalidResetTokenError(null)).toBe(false);
    expect(isInvalidResetTokenError(undefined)).toBe(false);
  });
});
