import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ContingencyTicket } from "./contingency-ticket";
import { OfflineBanner } from "./offline-banner";
import { QrPanel } from "./qr-panel";

const HOUR = 3_600_000;
const plain = (html: string) => html.replaceAll(" ", " ");

describe("OfflineBanner", () => {
  test("shows the elapsed offline time and the warning copy for 40 h", () => {
    const html = renderToStaticMarkup(
      <OfflineBanner
        status={{
          online: false,
          durationMs: 41 * HOUR + 5 * 60_000,
          alert: "warn_40h",
          contingencyBlocked: false,
        }}
      />,
    );
    expect(html).toContain("Más de 40 horas sin conexión");
    expect(html).toContain("hace 41 h 5 min");
  });

  test("announces the contingency block assertively and other states politely", () => {
    const blocked = renderToStaticMarkup(
      <OfflineBanner
        status={{
          online: false,
          durationMs: 49 * HOUR,
          alert: "warn_40h",
          contingencyBlocked: true,
        }}
      />,
    );
    expect(blocked).toContain('role="alert"');
    expect(blocked).toContain("bloqueadas");

    const offline = renderToStaticMarkup(
      <OfflineBanner
        status={{ online: false, durationMs: HOUR, alert: null, contingencyBlocked: false }}
      />,
    );
    expect(offline).toContain('role="status"');
  });

  test("lets the caller replace the plain offline message only", () => {
    const status = { online: false, durationMs: 1000, alert: null, contingencyBlocked: false };
    expect(
      renderToStaticMarkup(
        <OfflineBanner status={status} offlineMessage="Pide las comandas en voz alta" />,
      ),
    ).toContain("Pide las comandas en voz alta");
    expect(
      renderToStaticMarkup(
        <OfflineBanner
          status={{ ...status, alert: "warn_24h" }}
          offlineMessage="Pide las comandas en voz alta"
        />,
      ),
    ).not.toContain("Pide las comandas en voz alta");
  });

  test("shows the online state without an elapsed time", () => {
    const html = renderToStaticMarkup(
      <OfflineBanner
        status={{ online: true, durationMs: 0, alert: null, contingencyBlocked: false }}
      />,
    );
    expect(html).toContain("En línea");
    expect(html).not.toContain("hace");
  });
});

describe("QrPanel", () => {
  test("renders a labelled image and the short code", () => {
    const html = renderToStaticMarkup(<QrPanel url="https://example.com/m/x" shortCode="K7P2" />);
    expect(html).toContain('role="img"');
    expect(html).toContain("K7P2");
    expect(html).toContain("<path");
  });
});

describe("ContingencyTicket", () => {
  const props = {
    restaurant: { name: "La Fonda", nit: "900.123.456-7", address: "Cra 7 # 10-20" },
    soldAt: new Date("2026-10-03T22:05:09Z"),
    lines: [{ id: "1", quantity: 2, name: "Bandeja paisa", unitPrice: 26000, total: 52000 }],
    taxes: [{ label: "Impoconsumo 8%", amount: 3852 }],
    total: 52000,
    tip: 5200,
    payments: [{ id: "p", tender: "cash" as const, amount: 57200 }],
  };

  test("carries the original sale time and the offline mark but no CUDE, QR or signature", () => {
    const html = plain(renderToStaticMarkup(<ContingencyTicket {...props} />));
    expect(html).toContain("03/10/2026 17:05:09");
    expect(html).toContain("registrado sin conexión");
    expect(html).toContain("NIT 900.123.456-7");
    expect(html).toContain("$ 26.000");
    expect(html).not.toMatch(/CUDE|firma/i);
    expect(html).not.toContain("<svg");
  });

  test("shows the cashier and the Location when given", () => {
    const html = plain(
      renderToStaticMarkup(
        <ContingencyTicket
          {...props}
          cashier="Ana Pérez"
          location={{ name: "Sede Centro", address: "Cra 9 # 12-30" }}
        />,
      ),
    );
    expect(html).toContain("Local: Sede Centro");
    expect(html).toContain("Cra 9 # 12-30");
    expect(html).toContain("Cajero: Ana Pérez");
  });

  test("leaves out the cashier, the Location and the NIT when they are not known", () => {
    const html = renderToStaticMarkup(
      <ContingencyTicket {...props} restaurant={{ name: "La Fonda" }} />,
    );
    expect(html).not.toContain("Cajero");
    expect(html).not.toContain("Local:");
    expect(html).not.toContain("NIT");
  });

  test("defaults the buyer to final consumer and shows a buyer when given", () => {
    expect(renderToStaticMarkup(<ContingencyTicket {...props} />)).toContain("Consumidor final");
    expect(
      renderToStaticMarkup(
        <ContingencyTicket {...props} buyer={{ name: "Ana Ruiz", documentNumber: "1020304050" }} />,
      ),
    ).toContain("Ana Ruiz");
  });
});
