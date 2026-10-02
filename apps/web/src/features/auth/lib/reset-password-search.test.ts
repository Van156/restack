import { describe, expect, test } from "bun:test";

import { resetPasswordSearchSchema, resolveResetPasswordView } from "./reset-password-search";

describe("resolveResetPasswordView", () => {
  test("a token without an error shows the form", () => {
    expect(resolveResetPasswordView({ token: "abc" })).toEqual({ kind: "form", token: "abc" });
  });

  test("INVALID_TOKEN is the invalid-link state even when a token is present", () => {
    expect(resolveResetPasswordView({ error: "INVALID_TOKEN" })).toEqual({ kind: "invalid" });
    expect(resolveResetPasswordView({ token: "abc", error: "INVALID_TOKEN" })).toEqual({
      kind: "invalid",
    });
  });

  test("a missing or empty token is the invalid-link state", () => {
    expect(resolveResetPasswordView({})).toEqual({ kind: "invalid" });
    expect(resolveResetPasswordView({ token: "" })).toEqual({ kind: "invalid" });
  });
});

describe("resetPasswordSearchSchema", () => {
  test("accepts an empty search and drops unknown keys", () => {
    expect(resetPasswordSearchSchema.parse({})).toEqual({});
    expect(resetPasswordSearchSchema.parse({ token: "t", other: "x" })).toEqual({ token: "t" });
  });
});
