import { describe, expect, test } from "bun:test";

import {
  resolveAcceptInvitationErrorState,
  resolveInvitationSignUpErrorState,
} from "./accept-invitation-errors";

function fetchError(status: number, code: string, message = "x") {
  return { status, statusText: "Error", code, message };
}

describe("resolveAcceptInvitationErrorState (signed-in flow, R2.3/R2.5/R2.6)", () => {
  test("maps the recipient-mismatch code to mismatch (R2.5)", () => {
    expect(
      resolveAcceptInvitationErrorState(
        fetchError(403, "YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION"),
      ),
    ).toBe("mismatch");
  });

  test("maps acceptInvitation/rejectInvitation's INVITATION_NOT_FOUND code to not-found (R2.6)", () => {
    expect(resolveAcceptInvitationErrorState(fetchError(400, "INVITATION_NOT_FOUND"))).toBe(
      "not-found",
    );
  });

  test("falls back to not-found for a plain 400 with no code, matching getInvitation's own generic error (R2.6)", () => {
    expect(
      resolveAcceptInvitationErrorState({
        status: 400,
        statusText: "Bad Request",
        message: "Invitation not found!",
      }),
    ).toBe("not-found");
  });

  test("anything else is unknown", () => {
    expect(resolveAcceptInvitationErrorState(fetchError(500, "SOMETHING_ELSE"))).toBe("unknown");
    expect(resolveAcceptInvitationErrorState(undefined)).toBe("unknown");
  });
});

describe("resolveInvitationSignUpErrorState (signed-out flow, R2.4)", () => {
  test("maps INVITATION_EMAIL_ALREADY_REGISTERED to already-registered", () => {
    expect(
      resolveInvitationSignUpErrorState(fetchError(409, "INVITATION_EMAIL_ALREADY_REGISTERED")),
    ).toBe("already-registered");
  });

  test("maps INVITATION_NOT_FOUND and INVALID_INVITATION_TOKEN to invalid-or-expired", () => {
    expect(resolveInvitationSignUpErrorState(fetchError(400, "INVITATION_NOT_FOUND"))).toBe(
      "invalid-or-expired",
    );
    expect(resolveInvitationSignUpErrorState(fetchError(400, "INVALID_INVITATION_TOKEN"))).toBe(
      "invalid-or-expired",
    );
  });

  test("anything else is unknown", () => {
    expect(resolveInvitationSignUpErrorState(fetchError(500, "SOMETHING_ELSE"))).toBe("unknown");
    expect(resolveInvitationSignUpErrorState(undefined)).toBe("unknown");
  });
});
