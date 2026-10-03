import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { GuestView } from "../lib/guest-view";
import GuestCallView from "./guest-call-view";

const reasons = [
  { id: "need_something", label: "Necesito algo" },
  { id: "cutlery_napkins", label: "Más cubiertos o servilletas" },
  { id: "pay", label: "Quiero pagar" },
] as const;

const render = (view: GuestView, busy = false) =>
  renderToStaticMarkup(<GuestCallView view={view} busy={busy} onCall={() => {}} />);

const open = (over: Partial<Extract<GuestView, { kind: "open" }>> = {}): GuestView => ({
  kind: "open",
  tableName: "Mesa 4",
  reasons,
  canCall: true,
  call: null,
  cooldownSeconds: null,
  notice: null,
  ...over,
});

describe("GuestCallView", () => {
  test("shows the Table name and the three reasons as enabled buttons", () => {
    const html = render(open());
    expect(html).toContain("Mesa 4");
    for (const reason of reasons) {
      expect(html).toContain(reason.label);
    }
    expect(html).not.toContain(' disabled=""');
  });

  test("disables every reason while a call is open and says the waiter was told", () => {
    const html = render(
      open({ canCall: false, call: { reasonLabel: "Quiero pagar", onTheWay: false } }),
    );
    expect(html).toContain("Avisamos a tu mesero");
    expect(html.match(/ disabled=""/g)?.length).toBe(3);
  });

  test("says the waiter is on the way once acknowledged", () => {
    expect(
      render(open({ canCall: false, call: { reasonLabel: "Quiero pagar", onTheWay: true } })),
    ).toContain("Tu mesero va en camino");
  });

  test("counts the cooldown down and keeps the buttons disabled", () => {
    const html = render(open({ canCall: false, cooldownSeconds: 22 }));
    expect(html).toContain("Podrás llamar de nuevo en 22 s");
    expect(html.match(/ disabled=""/g)?.length).toBe(3);
  });

  test("offline shows the exact copy and no button", () => {
    const html = render({
      kind: "offline",
      message: "El restaurante está sin conexión. Llama a tu mesero con la mano.",
    });
    expect(html).toContain("El restaurante está sin conexión. Llama a tu mesero con la mano.");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("Mesa");
  });

  test("closed, expired, invalid and throttled show their message and no button", () => {
    const views: GuestView[] = [
      { kind: "closed", message: "Esta mesa ya cerró. Gracias por venir." },
      { kind: "expired", message: "Este código QR venció." },
      { kind: "invalid", message: "Este código QR no es válido." },
      { kind: "throttled", seconds: 30 },
    ];
    for (const view of views) {
      expect(render(view)).not.toContain("<button");
    }
    expect(render({ kind: "throttled", seconds: 30 })).toContain("Vuelve a intentar en 30 s");
  });

  test("announces status changes politely", () => {
    expect(render(open())).toContain('aria-live="polite"');
  });
});
