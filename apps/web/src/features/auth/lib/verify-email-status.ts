/** R0.2/R0.4: `/verify-email` always redirects to `callbackURL`, appending `?error=<CODE>` on failure (better-auth 1.7.5). Maps it to the route's three states. */
export type VerifyEmailStatus = "success" | "expired" | "invalid";

export function resolveVerifyEmailStatus(errorParam: string | null | undefined): VerifyEmailStatus {
  if (!errorParam) {
    return "success";
  }
  if (errorParam === "TOKEN_EXPIRED") {
    return "expired";
  }
  return "invalid";
}
