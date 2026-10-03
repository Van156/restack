import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { toCountRows, toIncidentRows, toOutboxRows } from "../lib/dian-rows";
import { dianSummary, habilitacionSteps } from "../lib/habilitacion";
import ConnectionForm from "./connection-form";
import DianStatusCard from "./dian-status-card";
import DocumentCountsView from "./document-counts-view";
import HabilitacionWizard from "./habilitacion-wizard";
import IncidentsView from "./incidents-view";
import OutboxView from "./outbox-view";

const noop = () => {};
const now = new Date("2026-10-03T15:00:00.000Z");

function card(over: Partial<Parameters<typeof DianStatusCard>[0]> = {}) {
  return renderToStaticMarkup(
    <DianStatusCard
      summary={dianSummary({ enabled: true, planAllowsDian: true, habilitacion: "enabled" })}
      habilitacion="enabled"
      enabled
      canChoose
      hasConnection
      refreshing={false}
      choosing={false}
      onRefresh={noop}
      onToggleChoice={noop}
      {...over}
    />,
  );
}

describe("DianStatusCard", () => {
  test("the Owner gets the on/off button with the current state", () => {
    const html = card();
    expect(html).toContain("Habilitada");
    expect(html).toContain("Desactivar");
  });

  test("an Administrator sees who decides instead of the button", () => {
    const html = card({ canChoose: false });
    expect(html).toContain("Solo el propietario decide");
    expect(html).not.toContain(">Desactivar<");
  });

  test("refreshing the habilitación needs a connection", () => {
    const html = card({ hasConnection: false, habilitacion: "not_started" });
    expect(html).toContain("No iniciada");
    expect(html).toContain("Conecta un proveedor para consultarla.");
    expect(html).toContain("disabled");
  });
});

describe("HabilitacionWizard", () => {
  test("marks the current step, links out and promises no automation", () => {
    const html = renderToStaticMarkup(
      <HabilitacionWizard
        steps={habilitacionSteps({ connection: null, habilitacion: "not_started" })}
      />,
    );
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Ir al sitio de la DIAN");
    expect(html).toContain("esta pantalla no lo hace por ti");
    expect(html).toContain("Pasar el set de pruebas del proveedor");
  });
});

describe("ConnectionForm", () => {
  test("shows a field error and never asks for a provider token", () => {
    const html = renderToStaticMarkup(
      <ConnectionForm
        values={{ provider: "alegra", companyReference: "", numberingPrefix: "" }}
        errors={{ companyReference: "Escribe la referencia de tu empresa en el proveedor." }}
        isPending={false}
        submitLabel="Conectar proveedor"
        onChange={noop}
        onSubmit={noop}
      />,
    );
    expect(html).toContain("Escribe la referencia");
    expect(html).toContain("Prefijo de la numeración POS");
    expect(html.toLowerCase()).not.toContain("token");
  });
});

describe("OutboxView", () => {
  const rows = toOutboxRows(
    [
      {
        documentId: "d1",
        kind: "pos_equivalent",
        saleTime: new Date("2026-10-03T13:00:00.000Z"),
        contingency: true,
        attempts: 3,
        nextAttemptAt: new Date(now.getTime() + 60_000),
        transmitBy: new Date(now.getTime() - 3_600_000),
        overdue: true,
        lastError: "Sin conexión",
      },
    ],
    now,
  );

  test("shows the deadline, the attempts and a retry for each document", () => {
    const html = renderToStaticMarkup(<OutboxView rows={rows} retryingId={null} onRetry={noop} />);
    expect(html).toContain("Venció hace 1 h");
    expect(html).toContain("Documento equivalente POS");
    expect(html).toContain("Reintentar ahora");
  });

  test("disables the retry of the document being retried only", () => {
    const html = renderToStaticMarkup(<OutboxView rows={rows} retryingId="d1" onRetry={noop} />);
    expect(html).toContain("disabled");
  });
});

describe("IncidentsView and DocumentCountsView", () => {
  test("the incident log marks an open incident", () => {
    const html = renderToStaticMarkup(
      <IncidentsView
        rows={toIncidentRows(
          [
            {
              id: "i",
              cause: "provider_unavailable",
              startedAt: new Date(now.getTime() - 3_600_000),
              endedAt: null,
              documentsCovered: 2,
              reported: false,
            },
          ],
          now,
        )}
      />,
    );
    expect(html).toContain("Abierto");
    expect(html).toContain("El proveedor no estaba disponible");
  });

  test("the counts flag a month over the fair use", () => {
    const html = renderToStaticMarkup(
      <DocumentCountsView rows={toCountRows([{ month: "2026-10", count: 5_100 }])} />,
    );
    expect(html).toContain("Pasó de 5.000 al mes");
  });
});
