import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import ActivationForm from "./activation-form";
import DeviceList, { type DeviceRow } from "./device-list";
import PairingCodeCard from "./pairing-code-card";
import PairingForm from "./pairing-form";

const now = new Date("2026-10-03T17:00:00Z");
const noop = async () => {};

const devices: DeviceRow[] = [
  {
    id: "d1",
    name: "Cocina",
    status: "active",
    lastSeenAt: new Date("2026-10-03T16:59:00Z"),
    activationExpiresAt: null,
    stationNames: ["Cocina caliente", "Bar"],
  },
  {
    id: "d2",
    name: "Barra",
    status: "pending",
    lastSeenAt: null,
    activationExpiresAt: new Date("2026-10-03T17:15:00Z"),
    stationNames: ["Bar"],
  },
  {
    id: "d3",
    name: "Vieja",
    status: "revoked",
    lastSeenAt: null,
    activationExpiresAt: null,
    stationNames: [],
  },
];

describe("DeviceList", () => {
  const html = renderToStaticMarkup(
    <DeviceList devices={devices} now={now} isBusy={false} onRename={noop} onRevoke={noop} />,
  );

  test("shows status, Stations and when a pending code expires", () => {
    expect(html).toContain("Activa");
    expect(html).toContain("Estaciones: Cocina caliente, Bar");
    expect(html).toContain("Esperando el código");
    expect(html).toContain("El código vence a las 12:15");
    expect(html).toContain("Revocada");
  });

  test("a revoked device offers neither rename nor revoke", () => {
    const revokedOnly = renderToStaticMarkup(
      <DeviceList
        devices={[devices[2]!]}
        now={now}
        isBusy={false}
        onRename={noop}
        onRevoke={noop}
      />,
    );
    expect(revokedOnly).not.toContain("Renombrar");
    expect(revokedOnly).not.toContain("Revocar");
    expect(html).toContain("Revocar");
  });

  test("explains the empty list", () => {
    expect(
      renderToStaticMarkup(
        <DeviceList devices={[]} now={now} isBusy={false} onRename={noop} onRevoke={noop} />,
      ),
    ).toContain("Aún no hay pantallas");
  });
});

describe("PairingCodeCard", () => {
  test("shows the grouped code, the expiry and the QR", () => {
    const html = renderToStaticMarkup(
      <PairingCodeCard
        deviceName="Cocina"
        code="ABCDEF23"
        url="https://app.example.com/activate?code=ABCDEF23"
        expiresAtLabel="12:15"
        onCopy={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(html).toContain("ABCD-EF23");
    expect(html).toContain("antes de las 12:15");
    expect(html).toContain("<svg");
  });
});

describe("PairingForm", () => {
  test("lists the Stations and reports both validation errors", () => {
    const html = renderToStaticMarkup(
      <PairingForm
        values={{ name: "", stationIds: [] }}
        errors={{ name: "Ponle un nombre.", stationIds: "Elige al menos una estación." }}
        stations={[{ id: "s1", name: "Bar" }]}
        isPending={false}
        onChange={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(html).toContain("Bar");
    expect(html).toContain("Ponle un nombre.");
    expect(html).toContain("Elige al menos una estación.");
  });
});

describe("ActivationForm", () => {
  const props = {
    code: "",
    error: null,
    isPending: false,
    onCodeChange: () => {},
    onSubmit: () => {},
  };

  test("disables activation until a code is typed", () => {
    expect(renderToStaticMarkup(<ActivationForm {...props} />)).toMatch(
      /<button[^>]*\sdisabled=""[^>]*>Activar pantalla<\/button>/,
    );
    expect(renderToStaticMarkup(<ActivationForm {...props} code="ABCD" />)).not.toMatch(
      /<button[^>]*\sdisabled=""[^>]*>Activar pantalla<\/button>/,
    );
  });

  test("shows the server's refusal", () => {
    expect(
      renderToStaticMarkup(
        <ActivationForm {...props} code="X" error="This pairing code is invalid or has expired." />,
      ),
    ).toContain("invalid or has expired");
  });
});
