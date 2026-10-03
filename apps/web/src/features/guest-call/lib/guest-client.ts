import { z } from "zod";

const reasonId = z.enum(["need_something", "cutlery_napkins", "pay"]);
/** A Waiter call reason as the public endpoint names it. */
export type GuestReasonId = z.infer<typeof reasonId>;

/** What the public endpoint says about a Table; nothing beyond the call function. */
const guestStateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("closed"), message: z.string() }),
  z.object({ status: z.literal("offline"), message: z.string() }),
  z.object({
    status: z.literal("open"),
    table: z.object({ name: z.string() }),
    reasons: z.array(z.object({ id: reasonId, label: z.string() })).readonly(),
    call: z.object({ reason: reasonId, status: z.enum(["open", "on_the_way"]) }).nullable(),
    cooldownUntil: z.string().nullable(),
    canCall: z.boolean(),
  }),
]);
export type GuestState = z.infer<typeof guestStateSchema>;

const refusalSchema = z.object({
  status: z.enum(["closed", "offline", "call_open", "cooldown"]),
  state: guestStateSchema,
  retryAfterSeconds: z.number().optional(),
});
export type RefusalReason = z.infer<typeof refusalSchema>["status"];

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

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

const expiredSchema = z.object({ message: z.string() });
const EXPIRED_MESSAGE = "Este código QR venció.";

async function toResult(response: Response): Promise<GuestResult> {
  if (response.status === 429) {
    return { kind: "throttled", retryAfterSeconds: retryAfter(response) };
  }
  if (response.status === 404) {
    return { kind: "invalid" };
  }
  const body = await readJson(response);
  if (body === null || typeof body !== "object") {
    return { kind: "error" };
  }
  if (response.status === 410) {
    const expired = expiredSchema.safeParse(body);
    return { kind: "expired", message: expired.success ? expired.data.message : EXPIRED_MESSAGE };
  }
  if (response.status === 409) {
    const refusal = refusalSchema.safeParse(body);
    return refusal.success
      ? {
          kind: "refused",
          reason: refusal.data.status,
          state: refusal.data.state,
          ...(refusal.data.retryAfterSeconds === undefined
            ? {}
            : { retryAfterSeconds: refusal.data.retryAfterSeconds }),
        }
      : { kind: "error" };
  }
  if (response.ok) {
    const state = guestStateSchema.safeParse(body);
    return state.success ? { kind: "state", state: state.data } : { kind: "error" };
  }
  return { kind: "error" };
}

/** Client of the public Waiter call endpoint; the guest id travels on every request, no cookies. */
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
