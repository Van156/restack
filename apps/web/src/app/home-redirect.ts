/** The part of a `getSession()` result that decides where `/` goes. */
export type HomeSessionResult = {
  data?: { user: unknown } | null;
  error?: unknown;
};

/**
 * Where `/` sends the visitor.
 *
 * - session: `/dashboard`
 * - error (network failure, 5xx, rejected promise): `/dashboard` as well, so the `_auth` guard
 *   stays the single owner of the "is this visitor signed in" decision and its failure handling.
 *   Sending an error to `/sign-in` here would bounce a signed-in user during an API outage.
 * - no session and no error: `/sign-in`
 */
export function resolveHomeRedirect(result: HomeSessionResult | null | undefined) {
  if (result?.data || result?.error) {
    return { to: "/dashboard" } as const;
  }
  return { to: "/sign-in" } as const;
}

/**
 * Looks up the session and maps the outcome to a redirect. A rejected lookup is logged and then
 * treated like a resolved error (see `resolveHomeRedirect`). The getter is a parameter so the
 * mapping is testable without the auth client.
 */
export async function loadHomeRedirect(getSession: () => Promise<HomeSessionResult>) {
  const session = await getSession().catch((error: unknown) => {
    console.error("Home redirect: session lookup failed", error);
    return { data: null, error };
  });
  return resolveHomeRedirect(session);
}
