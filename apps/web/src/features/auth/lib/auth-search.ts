import z from "zod";

/** Search params the auth pages thread between each other (sign-in, sign-up, `/login`, guards). */
export type AuthSearch = { redirect?: string; invitationId?: string; error?: string };

/** `validateSearch` for `/sign-in` and `/sign-up`. */
export const authSearchSchema = z.object({
  redirect: z.string().optional(),
  invitationId: z.string().optional(),
  // Set by better-auth on the `errorCallbackURL` return of a failed OAuth round trip.
  error: z.string().optional(),
});

/** Keeps only the known, non-empty string params; everything else is dropped. */
export function pickAuthSearch(search: Record<string, unknown> | undefined): AuthSearch {
  const out: AuthSearch = {};
  if (typeof search?.redirect === "string" && search.redirect !== "") {
    out.redirect = search.redirect;
  }
  if (typeof search?.invitationId === "string" && search.invitationId !== "") {
    out.invitationId = search.invitationId;
  }
  return out;
}

/** Target for `/login` and for route guards: `/sign-in`, preserving `redirect` and `invitationId`. */
export function signInRedirect(search?: Record<string, unknown>) {
  return { to: "/sign-in" as const, search: pickAuthSearch(search) };
}

/** Search for the sign-in <-> sign-up switch links. */
export function authLinkSearch(search?: AuthSearch): AuthSearch {
  return pickAuthSearch(search);
}

/**
 * Where a successful sign-in lands: back on the invitation when `invitationId`
 * is threaded (spec §4.2), otherwise the dashboard (R5.2).
 */
export function postSignInPath(search?: AuthSearch): string {
  return search?.invitationId
    ? `/accept-invitation/${encodeURIComponent(search.invitationId)}`
    : "/dashboard";
}

/**
 * URLs for `authClient.signIn.social` (R5.2, R5.3). Success lands on `callbackPath`
 * (default `postSignInPath`); a failed round trip returns to `errorPath` (better-auth
 * appends `?error=`), keeping `invitationId` (or the explicit `errorParams`, e.g. the
 * invitation `token`). `additionalData` carries the invitation id through the OAuth
 * state so the server can enforce the email match (decision 18).
 */
export function socialSignInTargets({
  origin,
  errorPath,
  callbackPath,
  errorParams,
  search,
}: {
  origin: string;
  errorPath: string;
  /** Defaults to `postSignInPath(search)`. */
  callbackPath?: string;
  /** Replaces the default `invitationId` query on the error URL; undefined values are dropped. */
  errorParams?: Record<string, string | undefined>;
  search?: AuthSearch;
}) {
  const invitationId = search?.invitationId;
  const query = Object.entries(errorParams ?? { invitationId })
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  return {
    callbackURL: `${origin}${callbackPath ?? postSignInPath(search)}`,
    errorCallbackURL: `${origin}${errorPath}${query ? `?${query}` : ""}`,
    additionalData: invitationId ? { invitationId } : undefined,
  };
}
