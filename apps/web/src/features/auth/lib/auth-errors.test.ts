import { describe, expect, test } from "bun:test";

import {
  betterAuthErrorBody,
  betterAuthErrorCode,
  betterAuthErrorMessage,
  isInvitationEmailAlreadyRegisteredError,
  isInvitationRecipientMismatchError,
} from "./auth-errors";

function fetchError(code: string, message: string) {
  return { status: 400, statusText: "Bad Request", code, message };
}

describe("betterAuthErrorBody", () => {
  test("reads the flat { code, message, status, statusText } better-auth client error", () => {
    const error = fetchError("SOME_CODE", "Some message");
    expect(betterAuthErrorBody(error)).toEqual({
      code: "SOME_CODE",
      message: "Some message",
      status: 400,
      statusText: "Bad Request",
    });
  });

  test("returns undefined for null, non-objects and objects without a numeric status", () => {
    expect(betterAuthErrorBody(null)).toBeUndefined();
    expect(betterAuthErrorBody(undefined)).toBeUndefined();
    expect(betterAuthErrorBody("boom")).toBeUndefined();
    expect(betterAuthErrorBody({})).toBeUndefined();
    expect(betterAuthErrorBody({ message: "x", code: "Y" })).toBeUndefined();
  });

  test("returns undefined for thrown Errors, even ones carrying a status (ORPCError-like)", () => {
    expect(betterAuthErrorBody(new TypeError("Failed to fetch"))).toBeUndefined();
    const withStatus = Object.assign(new Error("Internal server error"), {
      status: 500,
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(betterAuthErrorBody(withStatus)).toBeUndefined();
  });
});

describe("betterAuthErrorCode / betterAuthErrorMessage", () => {
  test("returns the code when present", () => {
    expect(betterAuthErrorCode(fetchError("ORGANIZATION_SLUG_ALREADY_TAKEN", "Slug taken"))).toBe(
      "ORGANIZATION_SLUG_ALREADY_TAKEN",
    );
  });

  test("returns the message when present, otherwise the fallback", () => {
    expect(betterAuthErrorMessage(fetchError("X", "Real message"), "fallback")).toBe(
      "Real message",
    );
    expect(betterAuthErrorMessage(null, "fallback")).toBe("fallback");
    expect(betterAuthErrorMessage({ status: 400, code: "X" }, "fallback")).toBe("fallback");
  });

  test("a thrown Error keeps the safe fallback instead of leaking its raw message", () => {
    expect(betterAuthErrorMessage(new TypeError("Failed to fetch"), "fallback")).toBe("fallback");
    expect(betterAuthErrorCode(new Error("x"))).toBeUndefined();
  });

  test("the real better-auth flat shape reaches the UI with the server message, not the fallback", () => {
    // Exactly what `fetchOptions.onError` (`context.error`) and the `{ data, error }`
    // result of `authClient.signIn.email` produce for a 401 (better-fetch 1.3.2).
    const realShape = {
      code: "INVALID_EMAIL_OR_PASSWORD",
      message: "Invalid email or password",
      status: 401,
      statusText: "Unauthorized",
    };
    expect(betterAuthErrorMessage(realShape, "Something went wrong.")).toBe(
      "Invalid email or password",
    );
  });

  test("falls back to the HTTP status text when the body has no message", () => {
    expect(betterAuthErrorMessage({ status: 502, statusText: "Bad Gateway" }, "fallback")).toBe(
      "Bad Gateway",
    );
  });
});

describe("specific error predicates", () => {
  test("isInvitationRecipientMismatchError matches only its exact code (R2.5)", () => {
    expect(
      isInvitationRecipientMismatchError(
        fetchError("YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION", "x"),
      ),
    ).toBe(true);
    expect(isInvitationRecipientMismatchError(fetchError("SOMETHING_ELSE", "x"))).toBe(false);
  });

  test("isInvitationEmailAlreadyRegisteredError matches only its exact code (R2.4)", () => {
    expect(
      isInvitationEmailAlreadyRegisteredError(
        fetchError("INVITATION_EMAIL_ALREADY_REGISTERED", "x"),
      ),
    ).toBe(true);
    expect(
      isInvitationEmailAlreadyRegisteredError(fetchError("INVALID_INVITATION_TOKEN", "x")),
    ).toBe(false);
  });
});
