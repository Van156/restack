import { describe, expect, test } from "bun:test";

import { toggleId, validateInviteForm } from "./invite-form";

describe("validateInviteForm", () => {
  const valid = { email: " Ana@Example.com ", role: "waiter", locationIds: ["l1"] };

  test("normalizes the email and passes role and Locations", () => {
    expect(validateInviteForm(valid)).toEqual({
      ok: true,
      value: { email: "ana@example.com", role: "waiter", locationIds: ["l1"] },
    });
  });

  test("requires a valid email, a role and at least one Location", () => {
    const result = validateInviteForm({ email: "nope", role: "", locationIds: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["email", "locationIds", "role"]);
    }
  });
});

describe("toggleId", () => {
  test("adds a missing id and removes a present one without mutating", () => {
    const ids = ["a"];
    expect(toggleId(ids, "b")).toEqual(["a", "b"]);
    expect(toggleId(ids, "a")).toEqual([]);
    expect(ids).toEqual(["a"]);
  });
});
