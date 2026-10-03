import { describe, expect, test } from "bun:test";

import type { GuestResponse, GuestState } from "./guest-client";
import { guestPollDelay, guestView, secondsLeft, GUEST_POLL_MS } from "./guest-view";

const NOW = new Date("2026-10-03T15:00:00.000Z");
const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

const reasons = [
  { id: "need_something", label: "Necesito algo" },
  { id: "cutlery_napkins", label: "Más cubiertos o servilletas" },
  { id: "pay", label: "Quiero pagar" },
] as const;

const open = (over: Partial<Extract<GuestState, { status: "open" }>> = {}): GuestResponse => ({
  kind: "state",
  state: {
    status: "open",
    table: { name: "Mesa 4" },
    reasons,
    call: null,
    cooldownUntil: null,
    canCall: true,
    ...over,
  },
});

const view = (last: GuestResponse | null, receivedAt = NOW, now = NOW, refreshFailed = false) =>
  guestView({ last, receivedAt, now, refreshFailed });

describe("secondsLeft", () => {
  test("rounds up so the countdown never shows 0 while time remains", () => {
    expect(secondsLeft(at(0.2), NOW)).toBe(1);
    expect(secondsLeft(at(20), NOW)).toBe(20);
  });

  test("is 0 once the moment has passed", () => {
    expect(secondsLeft(at(-5), NOW)).toBe(0);
  });
});

describe("guestView", () => {
  test("before the first answer it is loading", () => {
    expect(view(null)).toEqual({ kind: "loading" });
  });

  test("an open Table shows its name, the reasons and lets the guest call", () => {
    expect(view(open())).toEqual({
      kind: "open",
      tableName: "Mesa 4",
      reasons,
      canCall: true,
      call: null,
      cooldownSeconds: null,
      notice: null,
    });
  });

  test("a call in progress disables calling and says whether the waiter is on the way", () => {
    expect(view(open({ call: { reason: "pay", status: "open" }, canCall: false }))).toMatchObject({
      canCall: false,
      call: { reasonLabel: "Quiero pagar", onTheWay: false },
    });
    expect(
      view(open({ call: { reason: "pay", status: "on_the_way" }, canCall: false })),
    ).toMatchObject({ call: { reasonLabel: "Quiero pagar", onTheWay: true } });
  });

  test("the cooldown counts down from when the answer arrived and re-enables calling at zero", () => {
    const cooling = open({ cooldownUntil: at(30).toISOString(), canCall: false });
    expect(view(cooling, NOW, at(10))).toMatchObject({ canCall: false, cooldownSeconds: 20 });
    expect(view(cooling, NOW, at(31))).toMatchObject({ canCall: true, cooldownSeconds: null });
  });

  test("an elapsed cooldown never re-enables the button while a call is still open", () => {
    const stale = open({
      call: { reason: "pay", status: "open" },
      cooldownUntil: at(-1).toISOString(),
      canCall: false,
    });
    expect(view(stale)).toMatchObject({ canCall: false, cooldownSeconds: null });
  });

  test("offline shows the server copy and no Table, reasons or button", () => {
    const copy = "El restaurante está sin conexión. Llama a tu mesero con la mano.";
    const result = view({ kind: "state", state: { status: "offline", message: copy } });
    expect(result).toEqual({ kind: "offline", message: copy });
  });

  test("closed shows the server copy", () => {
    const copy = "Esta mesa ya cerró. Gracias por venir.";
    expect(view({ kind: "state", state: { status: "closed", message: copy } })).toEqual({
      kind: "closed",
      message: copy,
    });
  });

  test("expired keeps the server message and invalid has its own copy", () => {
    expect(view({ kind: "expired", message: "Este código QR venció." })).toEqual({
      kind: "expired",
      message: "Este código QR venció.",
    });
    expect(view({ kind: "invalid" })).toMatchObject({ kind: "invalid" });
  });

  test("throttled counts down the Retry-After from the moment it arrived", () => {
    expect(view({ kind: "throttled", retryAfterSeconds: 60 }, NOW, at(15))).toEqual({
      kind: "throttled",
      seconds: 45,
    });
  });

  test("a refused call becomes a notice on the fresh state", () => {
    const state = (open() as Extract<GuestResponse, { kind: "state" }>).state;
    expect(view({ kind: "refused", reason: "call_open", state })).toMatchObject({
      kind: "open",
      notice: "Ya avisamos a tu mesero. Espera un momento.",
    });
    expect(
      view({ kind: "refused", reason: "cooldown", retryAfterSeconds: 20, state }),
    ).toMatchObject({ kind: "open", notice: expect.stringContaining("de nuevo") });
  });

  test("a refusal because the Table closed or the restaurant went offline shows that state instead", () => {
    const closed: GuestState = {
      status: "closed",
      message: "Esta mesa ya cerró. Gracias por venir.",
    };
    expect(view({ kind: "refused", reason: "closed", state: closed })).toEqual({
      kind: "closed",
      message: closed.message,
    });
  });

  test("a failed refresh keeps the last good answer and says the page could not update", () => {
    expect(view(open(), NOW, NOW, true)).toMatchObject({
      kind: "open",
      notice: expect.stringContaining("actualizar"),
    });
    expect(view(null, NOW, NOW, true)).toEqual({ kind: "unreachable" });
  });
});

describe("guestPollDelay", () => {
  test("polls every few seconds while the page can change", () => {
    expect(GUEST_POLL_MS).toBe(5_000);
    expect(guestPollDelay(open())).toBe(GUEST_POLL_MS);
    expect(guestPollDelay(undefined)).toBe(GUEST_POLL_MS);
  });

  test("an offline restaurant keeps being checked", () => {
    expect(guestPollDelay({ kind: "state", state: { status: "offline", message: "x" } })).toBe(
      GUEST_POLL_MS,
    );
  });

  test("stops for a closed Table, an expired or an invalid code", () => {
    expect(guestPollDelay({ kind: "state", state: { status: "closed", message: "x" } })).toBe(
      false,
    );
    expect(guestPollDelay({ kind: "expired", message: "x" })).toBe(false);
    expect(guestPollDelay({ kind: "invalid" })).toBe(false);
  });

  test("a throttled answer waits its Retry-After before asking again", () => {
    expect(guestPollDelay({ kind: "throttled", retryAfterSeconds: 60 })).toBe(60_000);
    expect(guestPollDelay({ kind: "throttled", retryAfterSeconds: 2 })).toBe(GUEST_POLL_MS);
  });
});
