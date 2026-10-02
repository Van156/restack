import z from "zod";

import { newPasswordSchema } from "@/features/auth";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * R2.1: a valid address that differs from the current one (compared case-insensitively). Whether
 * the address is taken is never validated client-side or reported by the server (R2.3).
 */
export function createChangeEmailSchema(currentEmail: string) {
  return z.object({
    newEmail: z
      .email("Invalid email address")
      .refine((value) => normalizeEmail(value) !== normalizeEmail(currentEmail), {
        message: "Enter an address different from your current one",
      }),
  });
}

/** R3.1: same password rule as sign-up; Confirm password is form-only validation. */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
