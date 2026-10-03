import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { FloorPlanTile } from "./floor-plan-tile";
import { OrderStrip } from "./order-strip";
import { TicketCard } from "./ticket-card";

const plain = (html: string) => html.replaceAll(" ", " ");

describe("FloorPlanTile", () => {
  test("shows name, seats and state label", () => {
    const html = renderToStaticMarkup(<FloorPlanTile name="Mesa 4" seats={4} state="occupied" />);
    expect(html).toContain("Mesa 4");
    expect(html).toContain("4 puestos");
    expect(html).toContain("Ocupada");
  });

  test("shows the ready marker and the Waiter call age only when present", () => {
    const quiet = renderToStaticMarkup(<FloorPlanTile name="Mesa 1" seats={2} state="free" />);
    expect(quiet).not.toContain("Pedido listo");
    expect(quiet).not.toContain("Llamado");

    const busy = renderToStaticMarkup(
      <FloorPlanTile
        name="Mesa 1"
        seats={2}
        state="occupied"
        hasReadyTicket
        waiterCallAgeMs={125_000}
      />,
    );
    expect(busy).toContain("Pedido listo");
    expect(busy).toContain("Llamado hace 2 min");
  });
});

describe("OrderStrip", () => {
  test("formats the recorded line total as COP and shows the send state", () => {
    const html = plain(
      renderToStaticMarkup(
        <OrderStrip
          lines={[
            {
              id: "1",
              quantity: 2,
              name: "Bandeja paisa",
              state: "sent",
              total: 52000,
              note: "sin cebolla",
            },
            { id: "2", quantity: 1, name: "Limonada", state: "voided", total: 7000 },
          ]}
        />,
      ),
    );
    expect(html).toContain("$ 52.000");
    expect(html).toContain("sin cebolla");
    expect(html).toContain("Enviado");
    expect(html).toContain("Anulado");
  });

  test("says so when the order has no lines", () => {
    expect(renderToStaticMarkup(<OrderStrip lines={[]} />)).toContain("Aún no hay productos");
  });
});

describe("TicketCard", () => {
  test("shows Table, Station, status and the age since sent", () => {
    const html = renderToStaticMarkup(
      <TicketCard
        station="Cocina"
        table="Mesa 7"
        status="preparando"
        ageMs={9 * 60_000}
        lines={[]}
      />,
    );
    expect(html).toContain("Mesa 7");
    expect(html).toContain("Cocina");
    expect(html).toContain("Preparando");
    expect(html).toContain("9 min");
  });

  test("shows each measured step with its time, marking the one still running", () => {
    const html = renderToStaticMarkup(
      <TicketCard
        station="Cocina"
        table="Mesa 7"
        status="listo"
        ageMs={20 * 60_000}
        lines={[]}
        timings={[
          { label: "Preparación", ms: 11 * 60_000 },
          { label: "Espera de recogida", ms: 3 * 60_000, running: true },
        ]}
      />,
    );
    expect(html).toContain("Preparación");
    expect(html).toContain("11 min");
    expect(html).toContain("Espera de recogida");
    expect(html).toContain("3 min");
    expect(html).toContain("en curso");
    expect(html.match(/en curso/g)).toHaveLength(1);
  });

  test("shows no timings block without timings", () => {
    const html = renderToStaticMarkup(
      <TicketCard station="Bar" table="Mesa 2" status="nuevo" ageMs={0} lines={[]} />,
    );
    expect(html).not.toContain("<dl");
  });

  test("flags a voided line as a cancellation and renders the advance action only when given", () => {
    const lines = [{ id: "a", quantity: 1, name: "Arepa", voided: true }];
    const without = renderToStaticMarkup(
      <TicketCard station="Bar" table="Mesa 2" status="nuevo" ageMs={0} lines={lines} />,
    );
    expect(without).toContain("Anulado, no preparar");
    expect(without).not.toContain("<button");

    const withAction = renderToStaticMarkup(
      <TicketCard
        station="Bar"
        table="Mesa 2"
        status="nuevo"
        ageMs={0}
        lines={lines}
        advanceLabel="Preparar"
      />,
    );
    expect(withAction).toContain("Preparar");
  });
});
