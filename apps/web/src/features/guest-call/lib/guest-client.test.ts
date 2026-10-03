import { describe, expect, test } from "bun:test";

import { createGuestClient, type GuestState } from "./guest-client";

type Call = { url: string; init: RequestInit };

function fakeFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    return respond(call);
  };
  return { calls, fetcher: fetcher as unknown as typeof fetch };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const openState: GuestState = {
  status: "open",
  table: { name: "Mesa 4" },
  reasons: [{ id: "pay", label: "Quiero pagar" }],
  call: null,
  cooldownUntil: null,
  canCall: true,
};

function client(fetcher: typeof fetch) {
  return createGuestClient({
    baseUrl: "https://api.test/",
    guestId: "guest-id-1234567890",
    fetch: fetcher,
  });
}

describe("createGuestClient", () => {
  test("reads the state with the guest id header and no credentials", async () => {
    const { calls, fetcher } = fakeFetch(() => json(openState));
    const result = await client(fetcher).getState("a.b-c");
    expect(result).toEqual({ kind: "state", state: openState });
    expect(calls[0]?.url).toBe("https://api.test/api/public/waiter-call/a.b-c");
    expect(new Headers(calls[0]?.init.headers).get("x-guest-id")).toBe("guest-id-1234567890");
    expect(calls[0]?.init.credentials).toBe("omit");
    expect(calls[0]?.init.method ?? "GET").toBe("GET");
  });

  test("posts the reason as JSON with the same header and returns the new state", async () => {
    const { calls, fetcher } = fakeFetch(() => json(openState, 201));
    const result = await client(fetcher).call("tok", "pay");
    expect(result.kind).toBe("state");
    const call = calls[0]!;
    expect(call.init.method).toBe("POST");
    expect(call.init.body).toBe(JSON.stringify({ reason: "pay" }));
    const headers = new Headers(call.init.headers);
    expect(headers.get("x-guest-id")).toBe("guest-id-1234567890");
    expect(headers.get("content-type")).toBe("application/json");
  });

  test("encodes a token that carries characters outside the path alphabet", async () => {
    const { calls, fetcher } = fakeFetch(() => json(openState));
    await client(fetcher).getState("a/b");
    expect(calls[0]?.url).toEndWith("/a%2Fb");
  });

  test("closed and offline come back as states with the server copy", async () => {
    const closed: GuestState = {
      status: "closed",
      message: "Esta mesa ya cerró. Gracias por venir.",
    };
    const result = await client(fakeFetch(() => json(closed)).fetcher).getState("t");
    expect(result).toEqual({ kind: "state", state: closed });
  });

  test("410 is expired with its message and 404 is invalid", async () => {
    const expired = await client(
      fakeFetch(() => json({ status: "expired", message: "Este código QR venció." }, 410)).fetcher,
    ).getState("t");
    expect(expired).toEqual({ kind: "expired", message: "Este código QR venció." });
    const invalid = await client(
      fakeFetch(() => json({ status: "invalid" }, 404)).fetcher,
    ).getState("t");
    expect(invalid).toEqual({ kind: "invalid" });
  });

  test("429 carries Retry-After in seconds and falls back to 60 when it is missing or odd", async () => {
    const withHeader = await client(
      fakeFetch(() => json({ status: "throttled" }, 429, { "retry-after": "12" })).fetcher,
    ).getState("t");
    expect(withHeader).toEqual({ kind: "throttled", retryAfterSeconds: 12 });
    const odd: Record<string, string>[] = [{}, { "retry-after": "soon" }, { "retry-after": "0" }];
    for (const header of odd) {
      const result = await client(
        fakeFetch(() => json({ status: "throttled" }, 429, header)).fetcher,
      ).getState("t");
      expect(result).toEqual({ kind: "throttled", retryAfterSeconds: 60 });
    }
  });

  test("409 keeps the refusal reason, the retry seconds and the fresh state", async () => {
    const cooldown = await client(
      fakeFetch(() => json({ status: "cooldown", retryAfterSeconds: 20, state: openState }, 409))
        .fetcher,
    ).call("t", "pay");
    expect(cooldown).toEqual({
      kind: "refused",
      reason: "cooldown",
      retryAfterSeconds: 20,
      state: openState,
    });
    const open = await client(
      fakeFetch(() => json({ status: "call_open", state: openState }, 409)).fetcher,
    ).call("t", "pay");
    expect(open).toEqual({ kind: "refused", reason: "call_open", state: openState });
  });

  test("a state that does not have the documented shape is a plain error", async () => {
    const malformed = [
      { status: "open", table: { name: "Mesa 4" } },
      { ...openState, reasons: [{ id: "free_dessert", label: "Postre gratis" }] },
      { ...openState, canCall: "yes" },
      { status: "something_else" },
    ];
    for (const body of malformed) {
      expect(await client(fakeFetch(() => json(body)).fetcher).getState("t")).toEqual({
        kind: "error",
      });
    }
    expect(
      await client(
        fakeFetch(() => json({ status: "cooldown", state: { status: "open" } }, 409)).fetcher,
      ).call("t", "pay"),
    ).toEqual({ kind: "error" });
    expect(
      await client(fakeFetch(() => json({ status: "nope", state: openState }, 409)).fetcher).call(
        "t",
        "pay",
      ),
    ).toEqual({ kind: "error" });
  });

  test("a network failure, a 5xx or an unreadable body is a plain error", async () => {
    const network = await client(
      fakeFetch(() => {
        throw new TypeError("offline");
      }).fetcher,
    ).getState("t");
    expect(network).toEqual({ kind: "error" });
    expect(await client(fakeFetch(() => json({}, 500)).fetcher).getState("t")).toEqual({
      kind: "error",
    });
    expect(
      await client(fakeFetch(() => new Response("<html>", { status: 200 })).fetcher).getState("t"),
    ).toEqual({ kind: "error" });
    expect(
      await client(fakeFetch(() => json({ status: "bad_request" }, 400)).fetcher).call("t", "pay"),
    ).toEqual({
      kind: "error",
    });
  });
});
