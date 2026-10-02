import z from "zod";

/**
 * `validateSearch` for `/reset-password`. better-auth redirects here with `?token=<token>` for
 * a valid link or `?error=INVALID_TOKEN` for a used/expired/unknown one (better-auth 1.7.5).
 */
export const resetPasswordSearchSchema = z.object({
  token: z.string().optional(),
  error: z.string().optional(),
});

export type ResetPasswordSearch = z.infer<typeof resetPasswordSearchSchema>;

export type ResetPasswordView = { kind: "form"; token: string } | { kind: "invalid" };

/** R3.3: a usable link has a non-empty token and no `error`; everything else is the invalid-link state. */
export function resolveResetPasswordView(search: ResetPasswordSearch): ResetPasswordView {
  if (search.error || !search.token) {
    return { kind: "invalid" };
  }
  return { kind: "form", token: search.token };
}
