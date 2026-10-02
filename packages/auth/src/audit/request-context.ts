import { tryGetCurrentAuthEndpointContext } from "@better-auth/core/context";

/** ip/userAgent extracted from a request's headers, when available. */
export type RequestMeta = { ip: string | null; userAgent: string | null };

/** Reads the IP (first `x-forwarded-for` entry, else `x-real-ip`) and user agent. Never throws: metadata capture must not fail the action it records. */
export function extractRequestMeta(headers: Headers | null | undefined): RequestMeta {
  if (!headers) {
    return { ip: null, userAgent: null };
  }
  const forwardedFor = headers.get("x-forwarded-for");
  const firstForwarded = forwardedFor?.split(",")[0]?.trim();
  const ip =
    (firstForwarded && firstForwarded.length > 0 ? firstForwarded : null) ??
    headers.get("x-real-ip");
  return { ip, userAgent: headers.get("user-agent") };
}

/** The actor/impersonation/network context of the currently dispatching auth endpoint. */
export type CurrentAuditContext = {
  actorUserId: string | null;
  impersonatorUserId: string | null;
  ip: string | null;
  userAgent: string | null;
};

/**
 * Actor, impersonator and network context of the endpoint being dispatched, from better-auth's
 * AsyncLocalStorage context. Hook payload `user` fields change meaning per hook, so the request's
 * own session is the only reliable actor. Returns nulls outside an endpoint or without a session.
 * See docs/architecture/audit-log.md#request-context.
 */
export function currentAuditContext(): CurrentAuditContext {
  const ctx = tryGetCurrentAuthEndpointContext();
  const session = ctx?.context?.session ?? null;
  const { ip, userAgent } = extractRequestMeta(ctx?.headers ?? null);
  return {
    actorUserId: session?.user?.id ?? null,
    impersonatorUserId: session?.session?.impersonatedBy ?? null,
    ip,
    userAgent,
  };
}
