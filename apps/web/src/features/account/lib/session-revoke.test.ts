import { describe, expect, test } from "bun:test";

import { resolveRevokeOutcome } from "./session-revoke";

describe("resolveRevokeOutcome", () => {
  test("a successful revoke toasts success and closes the dialog", () => {
    expect(resolveRevokeOutcome(undefined)).toEqual({
      toast: { kind: "success", message: "Session signed out" },
      keepDialogOpen: false,
    });
  });

  test("the current-session refusal explains itself and closes the dialog", () => {
    const outcome = resolveRevokeOutcome({
      status: 400,
      code: "CANNOT_REVOKE_CURRENT_SESSION",
      message: "Cannot revoke",
    });
    expect(outcome.toast.kind).toBe("error");
    expect(outcome.toast.message).toContain("session you are using");
    expect(outcome.keepDialogOpen).toBe(false);
  });

  test("any other API error shows its message and keeps the dialog open for a retry", () => {
    const outcome = resolveRevokeOutcome({ status: 500, message: "Boom" });
    expect(outcome).toEqual({
      toast: { kind: "error", message: "Boom" },
      keepDialogOpen: true,
    });
  });

  test("a network failure falls back to a generic message and keeps the dialog open", () => {
    const outcome = resolveRevokeOutcome(new TypeError("Failed to fetch"));
    expect(outcome.toast.message).toBe("Could not sign out that session.");
    expect(outcome.keepDialogOpen).toBe(true);
  });
});
