import { describe, expect, test } from "bun:test";

import {
  dangerZoneView,
  isLastOwner,
  memberLabel,
  transferCandidates,
  transferOwnershipErrorMessage,
  type DangerZoneMember,
} from "./org-danger-zone";

const ada: DangerZoneMember = {
  id: "m1",
  userId: "u1",
  role: "owner",
  user: { name: "Ada", email: "ada@example.com" },
};
const bob: DangerZoneMember = { id: "m2", userId: "u2", role: "admin", user: { name: "Bob" } };
const cy: DangerZoneMember = { id: "m3", userId: "u3", role: "member" };

describe("transferCandidates (R8.4)", () => {
  test("excludes the caller and sorts by label", () => {
    expect(transferCandidates([cy, ada, bob], "u1")).toEqual([
      { id: "m2", label: "Bob" },
      { id: "m3", label: "m3" },
    ]);
  });
});

describe("memberLabel", () => {
  test("prefers name and email, then either, then the id", () => {
    expect(memberLabel(ada)).toBe("Ada (ada@example.com)");
    expect(memberLabel(bob)).toBe("Bob");
    expect(memberLabel({ id: "m9", userId: "u9", role: "member", user: { email: "x@y.z" } })).toBe(
      "x@y.z",
    );
    expect(memberLabel(cy)).toBe("m3");
  });
});

describe("isLastOwner (R10.1)", () => {
  test("true when the caller is the only owner", () => {
    expect(isLastOwner([ada, bob, cy], "u1")).toBe(true);
  });

  test("false when another owner exists, including a multi-role string", () => {
    expect(isLastOwner([ada, { ...bob, role: "admin, owner" }], "u1")).toBe(false);
  });

  test("false for a non-owner caller", () => {
    expect(isLastOwner([ada, bob], "u2")).toBe(false);
  });
});

describe("transferOwnershipErrorMessage", () => {
  test.each([
    "TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS",
    "FORBIDDEN",
    "NOT_FOUND",
    "BAD_REQUEST",
    "CONFLICT",
  ])("maps %s to dedicated copy", (code) => {
    const message = transferOwnershipErrorMessage({ code, message: "server text" });
    expect(message).not.toBe("Could not transfer ownership.");
    expect(message).not.toBe("server text");
  });

  test("the target-limit copy names the cause", () => {
    expect(
      transferOwnershipErrorMessage({ code: "TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS" }),
    ).toContain("maximum number of organizations");
  });

  test("unknown codes and non-objects fall back", () => {
    expect(transferOwnershipErrorMessage({ code: "INTERNAL_SERVER_ERROR" })).toBe(
      "Could not transfer ownership.",
    );
    expect(transferOwnershipErrorMessage(new Error("x"))).toBe("Could not transfer ownership.");
    expect(transferOwnershipErrorMessage(null)).toBe("Could not transfer ownership.");
  });
});

describe("dangerZoneView", () => {
  const settled = { isPending: false, isError: false };

  test("is pending while the session or the caller's role loads", () => {
    expect(dangerZoneView({ sessionPending: true, rolePending: false, directory: settled })).toBe(
      "pending",
    );
    expect(dangerZoneView({ sessionPending: false, rolePending: true, directory: settled })).toBe(
      "pending",
    );
  });

  test("is pending while the directory loads", () => {
    expect(
      dangerZoneView({
        sessionPending: false,
        rolePending: false,
        directory: { isPending: true, isError: false },
      }),
    ).toBe("pending");
  });

  test("is an error state when the directory failed, so last-owner status is not guessed", () => {
    expect(
      dangerZoneView({
        sessionPending: false,
        rolePending: false,
        directory: { isPending: false, isError: true },
      }),
    ).toBe("directory-error");
  });

  test("is ready once everything settled", () => {
    expect(dangerZoneView({ sessionPending: false, rolePending: false, directory: settled })).toBe(
      "ready",
    );
  });
});

describe("transferOwnershipErrorMessage limit code", () => {
  test("maps the owned-organization limit code to its copy", () => {
    expect(
      transferOwnershipErrorMessage({ code: "TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS" }),
    ).toContain("maximum number of organizations");
  });
});
