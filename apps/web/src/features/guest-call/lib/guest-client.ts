/** A Waiter call reason as the public endpoint names it. */
export type GuestReasonId = "need_something" | "cutlery_napkins" | "pay";

/** What the public endpoint says about a Table; nothing beyond the call function. */
export type GuestState =
  | { status: "closed"; message: string }
  | { status: "offline"; message: string }
  | {
      status: "open";
      table: { name: string };
      reasons: readonly { id: GuestReasonId; label: string }[];
      call: { reason: GuestReasonId; status: "open" | "on_the_way" } | null;
      cooldownUntil: string | null;
      canCall: boolean;
    };

export type RefusalReason = "closed" | "offline" | "call_open" | "cooldown";

export type GuestResponse =
  | { kind: "state"; state: GuestState }
  | { kind: "expired"; message: string }
  | { kind: "invalid" }
  | { kind: "throttled"; retryAfterSeconds: number }
  | { kind: "refused"; reason: RefusalReason; state: GuestState; retryAfterSeconds?: number };

/** A `GuestResponse`, or a failure to reach or read the server. */
export type GuestResult = GuestResponse | { kind: "error" };

export type GuestClient = {
  getState(token: string): Promise<GuestResult>;
  call(token: string, reason: GuestReasonId): Promise<GuestResult>;
};

const DEFAULT_RETRY_SECONDS = 60;

function retryAfter(response: Response): number {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : DEFAULT_RETRY_SECONDS;
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await response.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function toResult(response: Response): Promise<GuestResult> {
  if (response.status === 429) {
    return { kind: "throttled", retryAfterSeconds: retryAfter(response) };
  }
  if (response.status === 404) {
    return { kind: "invalid" };
  }
  const body = await readJson(response);
  if (!body) {
    return { kind: "error" };
  }
  if (response.status === 410) {
    return {
      kind: "expired",
      message: typeof body.message === "string" ? body.message : "Este código QR venció.",
    };
  }
  if (response.status === 409 && typeof body.status === "string" && body.state) {
    const reason = body.status as RefusalReason;
    return {
      kind: "refused",
      reason,
      state: body.state as GuestState,
      ...(typeof body.retryAfterSeconds === "number"
        ? { retryAfterSeconds: body.retryAfterSeconds }
        : {}),
    };
  }
  if (response.ok && typeof body.status === "string") {
    return { kind: "state", state: body as GuestState };
  }
  return { kind: "error" };
}

/**
 * Client of the public Waiter call endpoint. The guest id travels on every request so the server
 * can tell guests of one Table apart; there are no cookies.
 */
export function createGuestClient({
  baseUrl,
  guestId,
  fetch: fetcher = fetch,
}: {
  baseUrl: string;
  guestId: string;
  fetch?: typeof fetch;
}): GuestClient {
  const root = `${baseUrl.replace(/\/$/, "")}/api/public/waiter-call`;

  async function send(token: string, init: RequestInit): Promise<GuestResult> {
    try {
      const response = await fetcher(`${root}/${encodeURIComponent(token)}`, {
        ...init,
        credentials: "omit",
        headers: { ...(init.headers as Record<string, string>), "x-guest-id": guestId },
      });
      return await toResult(response);
    } catch {
      return { kind: "error" };
    }
  }

  return {
    getState: (token) => send(token, { method: "GET" }),
    call: (token, reason) =>
      send(token, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      }),
  };
}
