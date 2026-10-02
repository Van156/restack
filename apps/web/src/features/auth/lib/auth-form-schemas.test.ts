import { describe, expect, test } from "bun:test";

import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "./auth-form-schemas";

const valid = {
  name: "Jane Doe",
  email: "jane@example.com",
  password: "password123",
  confirmPassword: "password123",
};

function messagesByPath(input: unknown) {
  const result = signUpSchema.safeParse(input);
  if (result.success) {
    return {};
  }
  const out: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0]);
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

describe("signUpSchema", () => {
  test("accepts matching passwords", () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  test("reports a mismatch on the confirmPassword field", () => {
    expect(messagesByPath({ ...valid, confirmPassword: "different123" })).toEqual({
      confirmPassword: ["Passwords do not match"],
    });
  });

  test("keeps the existing rules", () => {
    const errors = messagesByPath({
      name: "J",
      email: "nope",
      password: "short",
      confirmPassword: "short",
    });
    expect(errors.name).toEqual(["Name must be at least 2 characters"]);
    expect(errors.email).toEqual(["Invalid email address"]);
    expect(errors.password).toEqual(["Password must be at least 8 characters"]);
  });

  test("still reports a mismatch when other fields are also invalid", () => {
    expect(messagesByPath({ ...valid, name: "J", confirmPassword: "x" }).confirmPassword).toEqual([
      "Passwords do not match",
    ]);
  });
});

describe("signInSchema", () => {
  test("keeps email and password min 8 rules", () => {
    expect(signInSchema.safeParse({ email: "a@b.co", password: "12345678" }).success).toBe(true);
    expect(signInSchema.safeParse({ email: "x", password: "1" }).success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  test("accepts a valid email and rejects an invalid one", () => {
    expect(forgotPasswordSchema.safeParse({ email: "jane@example.com" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  test("accepts matching passwords of at least 8 characters", () => {
    expect(
      resetPasswordSchema.safeParse({ newPassword: "password123", confirmPassword: "password123" })
        .success,
    ).toBe(true);
  });

  test("rejects a short password", () => {
    expect(
      resetPasswordSchema.safeParse({ newPassword: "short", confirmPassword: "short" }).success,
    ).toBe(false);
  });

  test("reports a mismatch on the confirmPassword field", () => {
    const result = resetPasswordSchema.safeParse({
      newPassword: "password123",
      confirmPassword: "different123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["confirmPassword"]);
      expect(result.error.issues[0]?.message).toBe("Passwords do not match");
    }
  });
});
