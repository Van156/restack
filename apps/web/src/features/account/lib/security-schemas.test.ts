import { describe, expect, test } from "bun:test";

import { changePasswordSchema, createChangeEmailSchema } from "./security-schemas";

describe("createChangeEmailSchema", () => {
  const schema = createChangeEmailSchema("ada@example.com");

  test("accepts a different, valid address", () => {
    expect(schema.safeParse({ newEmail: "ada@new.example.com" }).success).toBe(true);
  });

  test("rejects an invalid address", () => {
    expect(schema.safeParse({ newEmail: "nope" }).error?.issues[0]?.message).toBe(
      "Invalid email address",
    );
  });

  test("rejects the current address, ignoring case", () => {
    const result = schema.safeParse({ newEmail: "ADA@Example.com" });
    expect(result.error?.issues[0]?.message).toBe(
      "Enter an address different from your current one",
    );
  });
});

describe("changePasswordSchema", () => {
  const valid = {
    currentPassword: "old-password",
    newPassword: "new-password",
    confirmPassword: "new-password",
  };

  test("accepts a matching new password of 8+ characters", () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });

  test("requires the current password", () => {
    expect(changePasswordSchema.safeParse({ ...valid, currentPassword: "" }).success).toBe(false);
  });

  test("applies the sign-up password length rule", () => {
    const result = changePasswordSchema.safeParse({
      ...valid,
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(result.error?.issues[0]?.message).toBe("Password must be at least 8 characters");
  });

  test("reports a mismatch on the confirm field", () => {
    const result = changePasswordSchema.safeParse({ ...valid, confirmPassword: "different" });
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });
});
