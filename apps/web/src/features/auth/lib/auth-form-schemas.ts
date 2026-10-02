import z from "zod";

/** The display-name rule shared by sign-up and the profile form; trimmed so a blank name never reaches the API. */
export const nameSchema = z.string().trim().min(2, "Name must be at least 2 characters");

/** The password rule shared by sign-up, reset and change-password forms (R3.3). */
export const newPasswordSchema = z.string().min(8, "Password must be at least 8 characters");

export const signInSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** Confirm Password is form-only validation (spec R3.3): it is never sent to the server. */
export const signUpSchema = z
  .object({
    name: nameSchema,
    email: z.email("Invalid email address"),
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/** R3.2: the email is the only input; whether an account exists is never validated client-side. */
export const forgotPasswordSchema = z.object({
  email: z.email("Invalid email address"),
});

/** R3.3: same password rule as sign-up; Confirm Password is form-only validation. */
export const resetPasswordSchema = z
  .object({
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
